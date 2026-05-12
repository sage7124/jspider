import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcryptjs';
import * as exceljs from 'exceljs';
import { generateTraineeWorksheet } from '../utils/excel';

const router = express.Router();
const prisma = new PrismaClient();

// ── Cross-Institute Internal Webhook Handlers (Unsecured from Admin JWT) ────────
// Middleware to verify cross-institute secret key
const verifyCrossSecret = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const headerSecret = req.headers['x-cross-secret'];
  const expectedSecret = process.env.CROSS_INSTITUTE_SECRET_KEY;
  if (!expectedSecret || headerSecret !== expectedSecret) {
    return res.status(401).json({ error: 'Unauthorized cross-institute access' });
  }
  next();
};

router.post('/external-punch', verifyCrossSecret, async (req, res) => {
  try {
    const { identifier, type } = req.body;
    const user = await prisma.user.findUnique({ where: { identifier } });
    if (!user) return res.status(404).json({ error: 'User not found locally' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();
    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];

    const slots = await prisma.slot.findMany({ where: { userId: user.id, dayOfWeek }, orderBy: { slotNo: 'asc' } });
    
    // User has no slot here today! Return error to signal calling institute to fallback to local logging!
    if (slots.length === 0) {
      return res.status(400).json({ error: 'No scheduled slots on this institute for today.' });
    }

    const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: user.id, date: today } } });

    let activeSlot = null;
    const typeUpper = (type as string).toUpperCase();

    // Simple logical slot determination
    if (typeUpper === 'OUT' && existing) {
      for (const s of slots) {
        if (existing[`inTime${s.slotNo}` as keyof typeof existing] && !existing[`outTime${s.slotNo}` as keyof typeof existing]) {
          activeSlot = s;
          break;
        }
      }
    }
    if (!activeSlot) {
      for (const s of slots) {
        const [eTime, eMod] = s.endTime.split(' ');
        let [eh, em] = eTime.split(':').map(Number);
        if (eMod === 'PM' && eh < 12) eh += 12;
        if (eMod === 'AM' && eh === 12) eh = 0;
        const slotEnd = new Date(today);
        slotEnd.setHours(eh, em, 0, 0);
        if (now.getTime() <= slotEnd.getTime()) {
          activeSlot = s;
          break;
        }
      }
    }
    if (!activeSlot) activeSlot = slots[slots.length - 1];
    
    let isLate = false;
    if (typeUpper === 'IN') {
      const [sTime, sMod] = activeSlot.startTime.split(' ');
      let [sh, sm] = sTime.split(':').map(Number);
      if (sMod === 'PM' && sh < 12) sh += 12;
      if (sMod === 'AM' && sh === 12) sh = 0;
      const slotStartTime = new Date(today);
      slotStartTime.setHours(sh, sm, 0, 0);
      if (now.getTime() > slotStartTime.getTime() && activeSlot.slotNo <= 3) isLate = true;
    }

    const activeSlotNo = activeSlot.slotNo;

    if (typeUpper === 'IN') {
      if (existing?.status === 'IN') return res.json({ success: true, message: 'Already punched in' });
      const updateD: any = { status: 'IN', inTime: existing?.inTime || now, isLate: existing ? existing.isLate : isLate };
      const createD: any = { userId: user.id, date: today, status: 'IN', inTime: now, isLate };
      if ([1,2,3,4,5].includes(activeSlotNo)) {
        updateD[`inTime${activeSlotNo}`] = now;
        createD[`inTime${activeSlotNo}`] = now;
      }
      await prisma.attendance.upsert({ where: { userId_date: { userId: user.id, date: today } }, update: updateD, create: createD });
    } else {
      if (!existing || existing.status === 'OUT') return res.json({ success: true, message: 'Not punched in' });
      const updateD: any = { status: 'OUT', outTime: now };
      if ([1,2,3,4,5].includes(activeSlotNo)) updateD[`outTime${activeSlotNo}`] = now;
      await prisma.attendance.update({ where: { userId_date: { userId: user.id, date: today } }, data: updateD });
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/external-monthly-data', verifyCrossSecret, async (req, res) => {
  try {
    const { identifier, month, year } = req.body;
    const user = await prisma.user.findUnique({ where: { identifier }, include: { slots: true } });
    if (!user) return res.json({ success: true, attendances: [], leaves: [], holidays: [], slots: [] });

    const m = parseInt(month);
    const y = parseInt(year);
    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);

    const attendances = await prisma.attendance.findMany({
      where: { userId: user.id, date: { gte: startDate, lte: endDate } }
    });
    const leaves = await prisma.leaveRequest.findMany({
      where: { userId: user.id, status: 'APPROVED', OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }] }
    });
    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } }
    });

    res.json({ success: true, attendances, leaves, holidays, slots: user.slots });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Standard Secured API Endpoints (Require JWT & Admin Privileges) ──────────
router.use(authenticateToken);
router.use(requireAdmin);

// ── Cross-Institute Fetcher & Merger Helpers ─────────────────────────────────────
async function fetchSisterReportData(identifier: string, month: any, year: any) {
  const sisterUrl = process.env.SISTER_INSTITUTE_API_URL;
  const secretKey = process.env.CROSS_INSTITUTE_SECRET_KEY;
  if (!sisterUrl || !secretKey) return null;
  try {
    const response = await fetch(`${sisterUrl}/api/admin/external-monthly-data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cross-secret': secretKey },
      body: JSON.stringify({ identifier, month, year })
    });
    if (!response.ok) return null;
    const resData: any = await response.json();
    return resData.success ? resData : null;
  } catch (e) {
    console.log("Sister data fetch error:", e);
    return null;
  }
}

async function broadcastLeaveToSister(payload: any) {
  const sisterUrl = process.env.SISTER_INSTITUTE_API_URL;
  const secretKey = process.env.CROSS_INSTITUTE_SECRET_KEY;
  if (!sisterUrl || !secretKey) return;
  try {
    await fetch(`${sisterUrl}/api/admin/external-leave-push`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cross-secret': secretKey },
      body: JSON.stringify(payload)
    });
  } catch (e) {
    console.log("Leave broadcast failure:", e);
  }
}

router.post('/external-leave-push', verifyCrossSecret, async (req, res) => {
  try {
    const { identifier, startDate, endDate, reason, adminReason, appliedDate, remarksAlternative, remarksOfficeUse } = req.body;
    const user = await prisma.user.findUnique({ where: { identifier } });
    if (!user) return res.status(404).json({ success: false, error: 'User unknown on this node' });

    // Replicate the authorized leave instantly without double-dipping leave balances, keeping visual parity!
    await prisma.leaveRequest.create({
      data: {
        userId: user.id,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        reason: reason || 'Synced Leave',
        status: 'APPROVED',
        adminReason: adminReason || 'Cross-institute Sync',
        appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
        remarksAlternative: remarksAlternative || null,
        remarksOfficeUse: remarksOfficeUse || null
      }
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

function mergeAttendances(localAtt: any[], remoteAtt: any[]) {
  const mergedMap = new Map<string, any>();
  localAtt.forEach(a => { mergedMap.set(new Date(a.date).toISOString().split('T')[0], { ...a }); });
  
  remoteAtt.forEach(rem => {
    const key = new Date(rem.date).toISOString().split('T')[0];
    if (!mergedMap.has(key)) {
      mergedMap.set(key, rem);
    } else {
      const loc = mergedMap.get(key);
      const combo = { ...loc, ...rem };
      if (loc.inTime && rem.inTime) combo.inTime = new Date(loc.inTime) < new Date(rem.inTime) ? loc.inTime : rem.inTime;
      if (loc.outTime && rem.outTime) combo.outTime = new Date(loc.outTime) > new Date(rem.outTime) ? loc.outTime : rem.outTime;
      combo.isLate = loc.isLate || rem.isLate;
      combo.status = (loc.status === 'IN' || rem.status === 'IN') ? 'IN' : 'OUT';
      for(let i = 1; i <= 5; i++) {
        const lIn = loc[`inTime${i}`];
        const rIn = rem[`inTime${i}`];
        if (lIn && rIn) {
          combo[`inTime${i}`] = new Date(lIn) < new Date(rIn) ? lIn : rIn;
        } else {
          combo[`inTime${i}`] = lIn || rIn;
        }

        const lOut = loc[`outTime${i}`];
        const rOut = rem[`outTime${i}`];
        if (lOut && rOut) {
          combo[`outTime${i}`] = new Date(lOut) > new Date(rOut) ? lOut : rOut;
        } else {
          combo[`outTime${i}`] = lOut || rOut;
        }
      }
      mergedMap.set(key, combo);
    }
  });
  return Array.from(mergedMap.values());
}

// ── GET all trainees with today's attendance ──────────────────────────────────
router.get('/attendance', async (_req: AuthRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfToday = new Date(today);
    endOfToday.setHours(23, 59, 59, 999);

    const { search } = _req.query;
    const users = await prisma.user.findMany({
      where: { 
        role: 'TRAINEE',
        OR: search ? [
          { fullName: { contains: search as string, mode: 'insensitive' } },
          { identifier: { contains: search as string, mode: 'insensitive' } },
          { department: { contains: search as string, mode: 'insensitive' } },
          { email: { contains: search as string, mode: 'insensitive' } }
        ] : undefined
      },
      orderBy: { fullName: 'asc' },
      include: {
        slots: { orderBy: [{ dayOfWeek: 'asc' }, { slotNo: 'asc' }] },
        attendances: { where: { date: today } },
      },
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        AND: [
          { startDate: { lte: endOfToday } },
          { endDate: { gte: today } }
        ]
      }
    });

    const result = users.map((user) => {
      const attendance = user.attendances[0];
      const leave = leaves.find(l => l.userId === user.id);
      const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][today.getDay()];
      const daySlots = user.slots.filter((s) => s.dayOfWeek === dayOfWeek) || [];
      const hasSlot = daySlots.length > 0;
      
      let status = attendance?.status;
      if (!status) {
        if (leave) status = 'LEAVE';
        else status = hasSlot ? 'ABSENT' : '--';
      }

      return {
        id: user.id,
        empCode: user.identifier,
        name: user.fullName,
        email: user.email,
        department: user.department,
        slots: user.slots.map((s) => ({
          day: s.dayOfWeek,
          start: s.startTime,
          end: s.endTime,
          slotNo: s.slotNo,
        })),
        status,
        date: today.toLocaleDateString('en-IN'),
        in: (() => {
          if (!attendance) return '--';
          const inTimes = [attendance.inTime1, attendance.inTime2, attendance.inTime3]
            .filter(t => t)
            .map(t => new Date(t));
          if (inTimes.length === 0) return '--';
          const latest = new Date(Math.max(...inTimes.map(t => t.getTime())));
          return latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })(),
        out: (() => {
          if (!attendance) return '--';
          const outTimes = [attendance.outTime1, attendance.outTime2, attendance.outTime3]
            .filter(t => t)
            .map(t => new Date(t));
          if (outTimes.length === 0) return '--';
          const latest = new Date(Math.max(...outTimes.map(t => t.getTime())));
          if (latest.getHours() === 0 && latest.getMinutes() === 0) return '--';
          return latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })(),
        inTime1: attendance?.inTime1 ? new Date(attendance.inTime1).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime1: attendance?.outTime1 ? (() => {
          const d = new Date(attendance.outTime1);
          if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })() : '--',
        inTime2: attendance?.inTime2 ? new Date(attendance.inTime2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime2: attendance?.outTime2 ? (() => {
          const d = new Date(attendance.outTime2);
          if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })() : '--',
        inTime3: attendance?.inTime3 ? new Date(attendance.inTime3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime3: attendance?.outTime3 ? (() => {
          const d = new Date(attendance.outTime3);
          if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })() : '--',
        isLate: attendance?.isLate || false,
        isApproved: user.isApproved,
        totalLeaves: user.totalLeaves,
        leaveBalance: user.leaveBalance,
      };
    });


    res.json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET pending approvals ─────────────────────────────────────────────────────
router.get('/pending', async (_req: AuthRequest, res) => {
  try {
    const pending = await prisma.user.findMany({
      where: { role: 'TRAINEE', isApproved: false },
      select: { id: true, identifier: true, fullName: true, email: true, department: true, createdAt: true },
      orderBy: { fullName: 'asc' }
    });
    res.json(pending);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Approve Trainee ───────────────────────────────────────────────────────────
router.post('/approve', async (req: AuthRequest, res) => {
  try {
    const { traineeId } = req.body;
    await prisma.user.update({ where: { id: traineeId }, data: { isApproved: true } });
    res.json({ message: 'Trainee approved successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Edit User Info ────────────────────────────────────────────────────────────
router.put('/user/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { 
      fullName, identifier, email, totalLeaves, leaveBalance, educationCompleted, subClassification,
      fatherName, motherName, photoUrl, dateOfJoining, officeTimings, presentAddress,
      permanentAddress, aadhaarNumber, aadhaarPhotoUrl, panNumber, panPhotoUrl,
      bankName, bankAccountNo, bankIfscCode, bankBranchName, emergencyContactName,
      emergencyContactMobile
    } = req.body;

    const updateData: any = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (identifier !== undefined) updateData.identifier = identifier;
    if (email !== undefined) updateData.email = email;
    if (educationCompleted !== undefined) updateData.educationCompleted = educationCompleted;
    if (subClassification !== undefined) updateData.subClassification = subClassification;
    if (fatherName !== undefined) updateData.fatherName = fatherName;
    if (motherName !== undefined) updateData.motherName = motherName;
    if (photoUrl !== undefined) updateData.photoUrl = photoUrl;
    if (dateOfJoining !== undefined) updateData.dateOfJoining = dateOfJoining;
    if (officeTimings !== undefined) updateData.officeTimings = officeTimings;
    if (presentAddress !== undefined) updateData.presentAddress = presentAddress;
    if (permanentAddress !== undefined) updateData.permanentAddress = permanentAddress;
    if (aadhaarNumber !== undefined) updateData.aadhaarNumber = aadhaarNumber;
    if (aadhaarPhotoUrl !== undefined) updateData.aadhaarPhotoUrl = aadhaarPhotoUrl;
    if (panNumber !== undefined) updateData.panNumber = panNumber;
    if (panPhotoUrl !== undefined) updateData.panPhotoUrl = panPhotoUrl;
    if (bankName !== undefined) updateData.bankName = bankName;
    if (bankAccountNo !== undefined) updateData.bankAccountNo = bankAccountNo;
    if (bankIfscCode !== undefined) updateData.bankIfscCode = bankIfscCode;
    if (bankBranchName !== undefined) updateData.bankBranchName = bankBranchName;
    if (emergencyContactName !== undefined) updateData.emergencyContactName = emergencyContactName;
    if (emergencyContactMobile !== undefined) updateData.emergencyContactMobile = emergencyContactMobile;
    
    if (totalLeaves !== undefined) updateData.totalLeaves = Number(totalLeaves);
    if (leaveBalance !== undefined) updateData.leaveBalance = Number(leaveBalance);

    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: updateData,
    });
    res.json({ message: 'User updated', user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/user/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id: Number(id) }
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Update Time Slots (replace all for user) ──────────────────────────────────
router.put('/slots/:userId', async (req: AuthRequest, res) => {
  try {
    const userId = Number(req.params.userId);
    const slots: Array<{ dayOfWeek: string; slotNo: number; startTime: string; endTime: string }> =
      req.body.slots;

    await prisma.slot.deleteMany({ where: { userId } });

    const toCreate = slots.filter((s) => s.startTime && s.endTime && s.startTime !== '--');
    if (toCreate.length > 0) {
      await prisma.slot.createMany({
        data: toCreate.map((s) => ({
          userId,
          dayOfWeek: s.dayOfWeek,
          slotNo: s.slotNo,
          startTime: s.startTime,
          endTime: s.endTime,
        })),
      });
    }

    res.json({ message: 'Slots updated successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Reset Password (resets to mobile number) ──────────────────────────────────
router.post('/reset-password/:id', async (req: AuthRequest, res) => {
  try {
    const { newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const passwordToSet = newPassword || user.identifier;
    const hashed = await bcrypt.hash(passwordToSet, 10);
    await prisma.user.update({ where: { id: Number(req.params.id) }, data: { password: hashed } });
    res.json({ message: newPassword ? 'Password updated successfully' : `Password has been reset to their mobile number: ${user.identifier}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Direct Leave (Admin to Trainee) ──────────────────────────────────────────
router.post('/leaves/direct', async (req: AuthRequest, res) => {
  try {
    const { traineeId, startDate, endDate, reason, appliedDate, remarksAlternative, remarksOfficeUse } = req.body;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid dates' });
    }
    
    const user = await prisma.user.findUnique({ where: { id: Number(traineeId) }, include: { slots: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    // Dynamically calculate working days in range based on assigned slot configuration
    let days = 0;
    const scheduledDays = new Set(user.slots.map(s => s.dayOfWeek.toUpperCase()));
    const dMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const curDay = dMap[d.getDay()];
      if (scheduledDays.has(curDay)) {
        days += 1;
      }
    }
    
    // Fallback to safety ensure at least 0
    days = Math.max(0, days);

    await prisma.$transaction([
      prisma.leaveRequest.create({
        data: {
          userId: Number(traineeId),
          startDate: start,
          endDate: end,
          reason: reason || 'Direct leave by admin',
          status: 'APPROVED',
          adminReason: 'Direct assignment',
          appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
          remarksAlternative: remarksAlternative || null,
          remarksOfficeUse: remarksOfficeUse || null
        }
      }),
      prisma.user.update({
        where: { id: Number(traineeId) },
        data: { leaveBalance: { decrement: days } }
      })
    ]);
    
    // Async broadcast to sister node instantaneously
    broadcastLeaveToSister({
      identifier: user.identifier,
      startDate: start,
      endDate: end,
      reason: reason || 'Direct leave by admin',
      adminReason: 'Direct assignment',
      appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
      remarksAlternative: remarksAlternative || null,
      remarksOfficeUse: remarksOfficeUse || null
    }).catch(() => {});

    res.json({ message: 'Leave assigned successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});




// ── Daily Attendance Report ───────────────────────────────────────────────────
router.get('/attendance/daily', async (req: AuthRequest, res) => {
  try {
    const { date, statusFilter } = req.query; // statusFilter: 'ALL', 'PRESENT', 'ABSENT'
    if (!date) return res.status(400).json({ error: 'Date is required' });

    const targetDate = new Date(date as string);
    targetDate.setHours(0, 0, 0, 0);
    const endOfTarget = new Date(targetDate);
    endOfTarget.setHours(23, 59, 59, 999);

    const trainees = await prisma.user.findMany({
      where: { role: 'TRAINEE' },
      orderBy: { fullName: 'asc' },
      include: { 
        attendances: { where: { date: targetDate } },
        slots: true
      }
    });

    const holidays = await prisma.holiday.findMany({
      where: { date: targetDate }
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        AND: [
          { startDate: { lte: endOfTarget } },
          { endDate: { gte: targetDate } }
        ]
      }
    });

    const result = trainees.map(t => {
      const att = t.attendances[0];
      const holiday = holidays.length > 0 ? holidays[0] : null;
      const leave = leaves.find(l => l.userId === t.id);

      const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][targetDate.getDay()];
      const daySlots = t.slots?.filter(s => s.dayOfWeek === dayOfWeek) || [];
      const hasSlot = daySlots.length > 0;

      let status = att ? att.status : (hasSlot ? 'ABSENT' : '--');
      if (!att && leave) {
        status = 'LEAVE';
      }
      let inTime = att?.inTime ? new Date(att.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
      let outTime = att?.outTime ? (() => {
        const d = new Date(att.outTime);
        if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      })() : '--';

      if (!att) {
        if (holiday) {
          status = 'HOLIDAY';
          inTime = 'HOLIDAY';
          outTime = holiday.name;
        } else if (leave) {
          status = 'LEAVE';
          inTime = 'LEAVE';
          outTime = leave.reason || 'Leave';
        }
      }

      return {
        id: t.id,
        name: t.fullName,
        empCode: t.identifier,
        status,
        inTime,
        outTime,
        inTime1: att?.inTime1 ? new Date(att.inTime1).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime1: att?.outTime1 ? (() => {
          const d = new Date(att.outTime1);
          if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })() : '--',
        inTime2: att?.inTime2 ? new Date(att.inTime2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime2: att?.outTime2 ? (() => {
          const d = new Date(att.outTime2);
          if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })() : '--',
        inTime3: att?.inTime3 ? new Date(att.inTime3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime3: att?.outTime3 ? (() => {
          const d = new Date(att.outTime3);
          if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })() : '--',
        inTime4: att?.inTime4 ? new Date(att.inTime4).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime4: att?.outTime4 ? (() => {
          const d = new Date(att.outTime4);
          if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })() : '--',
        inTime5: att?.inTime5 ? new Date(att.inTime5).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime5: att?.outTime5 ? (() => {
          const d = new Date(att.outTime5);
          if (d.getHours() === 0 && d.getMinutes() === 0) return '--';
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })() : '--',
      };
    });

    let filtered = result;
    if (statusFilter === 'PRESENT') filtered = result.filter(r => r.status === 'IN' || r.status === 'OUT');
    if (statusFilter === 'ABSENT') filtered = result.filter(r => r.status === 'ABSENT');

    res.json(filtered);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Removed generateTraineeWorksheet as it's now imported from utils/excel.ts

// ── Download Monthly Excel Report ─────────────────────────────────────────────
router.get('/reports/monthly', async (req: AuthRequest, res) => {
  try {
    const { month } = req.query; // e.g., "2026-04"
    if (!month || typeof month !== 'string') return res.status(400).json({ error: 'Month is required' });

    const [year, mon] = (month as string).split('-').map(Number);
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0, 23, 59, 59);
    const daysInMonth = endOfMonth.getDate();

    const trainees = await prisma.user.findMany({ 
      where: { role: 'TRAINEE' }, 
      include: { slots: true },
      orderBy: { fullName: 'asc' }
    });

    const attendances = await prisma.attendance.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      orderBy: { date: 'asc' }
    });

    const workbook = new exceljs.Workbook();
    workbook.creator = 'Attendance System';


    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } }
    });

    const allLeaves = await prisma.leaveRequest.findMany({
      where: {
        status: 'APPROVED',
        OR: [
          { startDate: { lte: endOfMonth }, endDate: { gte: startOfMonth } }
        ]
      }
    });

    for (const trainee of trainees) {
      // Use max 31 chars for worksheet name, replacing invalid chars
      const sheetName = trainee.fullName.replace(/[*/\?:\[\]]/g, '').substring(0, 31) || `Trainee_${trainee.id}`;
      let ws = workbook.getWorksheet(sheetName);
      if (ws) {
        // If duplicate names exist, append ID
        ws = workbook.addWorksheet(`${sheetName}_${trainee.id}`);
      } else {
        ws = workbook.addWorksheet(sheetName);
      }
      const traineeAtts = attendances.filter(a => a.userId === trainee.id);
      const traineeLeaves = allLeaves.filter(l => l.userId === trainee.id);
      generateTraineeWorksheet(ws, trainee, traineeAtts, year, mon, daysInMonth, holidays, traineeLeaves);
    }

    if (trainees.length === 0) {
      workbook.addWorksheet('No Data');
    }

    const monthLabel = month ? (month as string).replace('-', '_') : 'All';
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Attendance_${monthLabel}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Download Individual Excel Report ──────────────────────────────────────────
router.get('/reports/individual/:userId', async (req: AuthRequest, res) => {
  try {
    const userId = parseInt(req.params.userId as string);
    const { month } = req.query;

    if (!month || typeof month !== 'string') return res.status(400).json({ error: 'Month is required' });

    const user = await prisma.user.findUnique({ where: { id: userId }, include: { slots: true } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const [year, mon] = (month as string).split('-').map(Number);
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0, 23, 59, 59);
    const daysInMonth = endOfMonth.getDate();

    const attendances = await prisma.attendance.findMany({
      where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
      orderBy: { date: 'asc' }
    });

    const workbook = new exceljs.Workbook();
    const ws = workbook.addWorksheet(`${user.fullName.substring(0, 20)} Report`);
    
    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: startOfMonth, lte: endOfMonth } }
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'APPROVED',
        OR: [
          { startDate: { lte: endOfMonth }, endDate: { gte: startOfMonth } }
        ]
      }
    });

    let finalAttendances = attendances;
    let finalHolidays = holidays;
    let finalLeaves = leaves;

    // ── Fetch Sister Data & Cleverly Merge In Real Time
    const sister = await fetchSisterReportData(user.identifier, mon, year);
    if (sister) {
      // Convert serialized JSON strings back into native JS Date objects expected by Excel utility
      const remoteAtt = (sister.attendances || []).map((a: any) => {
        const res = { ...a, date: new Date(a.date) };
        if (a.inTime) res.inTime = new Date(a.inTime);
        if (a.outTime) res.outTime = new Date(a.outTime);
        for(let i=1; i<=5; i++) {
          if (a[`inTime${i}`]) res[`inTime${i}`] = new Date(a[`inTime${i}`]);
          if (a[`outTime${i}`]) res[`outTime${i}`] = new Date(a[`outTime${i}`]);
        }
        return res;
      });

      const remoteHolidays = (sister.holidays || []).map((h: any) => ({ ...h, date: new Date(h.date) }));
      const remoteLeaves = (sister.leaves || []).map((l: any) => ({ ...l, startDate: new Date(l.startDate), endDate: new Date(l.endDate) }));

      finalAttendances = mergeAttendances(attendances, remoteAtt);
      finalHolidays = [...holidays, ...remoteHolidays];
      finalLeaves = [...leaves, ...remoteLeaves];

      // ── Explicitly merge remote slots so the report utility has all schedule definitions!
      const remoteSlots = sister.slots || [];
      remoteSlots.forEach((rs: any) => {
        const exists = user.slots.find(s => s.dayOfWeek === rs.dayOfWeek && s.slotNo === rs.slotNo);
        if (!exists) {
          // Temporarily add to local user copy for worksheet generation
          user.slots.push(rs);
        }
      });
    }

    generateTraineeWorksheet(ws, user, finalAttendances, year, mon, daysInMonth, finalHolidays, finalLeaves);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${user.fullName}_${month}.xlsx`);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});



// ── Change Own Password ───────────────────────────────────────────────────────
router.post('/change-password', async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) return res.status(401).json({ error: 'Invalid current password' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Delete User ───────────────────────────────────────────────────────────────
router.delete('/user/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    // Delete related records first due to constraints
    await prisma.slot.deleteMany({ where: { userId: Number(id) } });
    await prisma.attendance.deleteMany({ where: { userId: Number(id) } });
    await prisma.leaveRequest.deleteMany({ where: { userId: Number(id) } });
    await prisma.user.delete({ where: { id: Number(id) } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Leave Management ─────────────────────────────────────────────────────────
router.put('/leaves/:userId', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const { totalLeaves } = req.body;
    await prisma.user.update({
      where: { id: Number(userId) },
      data: { 
        totalLeaves: Number(totalLeaves),
        leaveBalance: Number(totalLeaves) // Reset balance to total when updating? Or just set? 
        // User requested: "admin can decide the number of leaves for trainee in a year"
      }
    });
    res.json({ message: 'Leave balance updated successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leaves/requests', async (_req: AuthRequest, res) => {
  try {
    const requests = await prisma.leaveRequest.findMany({
      include: { user: { select: { fullName: true, identifier: true, department: true, leaveBalance: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/leaves/process', async (req: AuthRequest, res) => {
  try {
    const { requestId, status, newEndDate, adminReason } = req.body; // status: APPROVED or REJECTED
    const request = await prisma.leaveRequest.findUnique({
      where: { id: requestId },
      include: { user: true }
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.status !== 'PENDING') return res.status(400).json({ error: 'Request already processed' });

    if (status === 'APPROVED') {
      let finalEndDate = request.endDate;
      if (newEndDate) {
        finalEndDate = new Date(newEndDate);
        // Ensure finalEndDate is not before startDate
        if (finalEndDate < request.startDate) {
          return res.status(400).json({ error: 'End date cannot be before start date' });
        }
      }

      // Calculate days
      // Calculate working days based on schedule config dynamically
      let days = 0;
      const userWithSlots = await prisma.user.findUnique({ where: { id: request.userId }, include: { slots: true } });
      const scheduledDays = new Set(userWithSlots?.slots.map(s => s.dayOfWeek.toUpperCase()));
      const dMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

      for (let d = new Date(request.startDate); d <= finalEndDate; d.setDate(d.getDate() + 1)) {
        const curDay = dMap[d.getDay()];
        if (scheduledDays.has(curDay)) {
          days += 1;
        }
      }
      days = Math.max(0, days);

      await prisma.$transaction([
        prisma.leaveRequest.update({ 
          where: { id: requestId }, 
          data: { status: 'APPROVED', endDate: finalEndDate, adminReason } 
        }),
        prisma.user.update({
          where: { id: request.userId },
          data: { leaveBalance: { decrement: days } }
        })
      ]);

      // Cascade approval state to remote institutes instantly
      broadcastLeaveToSister({
        identifier: request.user.identifier,
        startDate: request.startDate,
        endDate: finalEndDate,
        reason: request.reason,
        adminReason: adminReason || 'Approved on primary',
        appliedDate: request.appliedDate,
        remarksAlternative: request.remarksAlternative || null,
        remarksOfficeUse: request.remarksOfficeUse || null
      }).catch(() => {});
    } else {
      await prisma.leaveRequest.update({ 
        where: { id: requestId }, 
        data: { status: 'REJECTED', adminReason } 
      });
    }

    res.json({ message: `Leave ${status.toLowerCase()} successfully` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/leaves/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const request = await prisma.leaveRequest.findUnique({
      where: { id: Number(id) },
      include: { user: true }
    });

    if (!request) return res.status(404).json({ error: 'Request not found' });

    // If it was already approved, credit back the leaveBalance
    if (request.status === 'APPROVED') {
      const days = Math.ceil((request.endDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      await prisma.user.update({
        where: { id: request.userId },
        data: { leaveBalance: { increment: days } }
      });
    }

    await prisma.leaveRequest.delete({ where: { id: Number(id) } });
    res.json({ message: 'Leave request deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ── Reset Device Locks ───────────────────────────────────────────────────────
router.post('/reset-device/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { type } = req.body; // 'mobile', 'desktop', or 'both'
    const data: any = {};
    if (type === 'mobile' || type === 'both') data.mobileDeviceId = null;
    if (type === 'desktop' || type === 'both') data.desktopDeviceId = null;
    await prisma.user.update({ where: { id: Number(id) }, data });
    res.json({ message: `Device lock (${type}) reset successfully` });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Find User by Device ID ───────────────────────────────────────────────────
router.get('/device/:deviceId', async (req: AuthRequest, res) => {
  try {
    const { deviceId } = req.params;
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { mobileDeviceId: deviceId as string },
          { desktopDeviceId: deviceId as string }
        ]
      },
      select: { id: true, identifier: true, fullName: true, role: true }
    });

    if (!user) return res.status(404).json({ error: 'No user found with this device ID' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Force Logout (Punch Out + Optional Reset) ─────────────────────────────
router.post('/force-logout/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId: Number(id), date: today } }
    });

    if (attendance && attendance.status === 'IN') {
      await prisma.attendance.update({
        where: { id: attendance.id },
        data: { status: 'OUT', outTime: new Date() }
      });
    }

    res.json({ message: 'User forced to logout (Punched Out if they were IN)' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/attendance-manual/:traineeId', async (req: AuthRequest, res) => {
  try {
    const { traineeId } = req.params;
    const { inTime, outTime, status, date, slotNo, clearPunchOut } = req.body; // inTime/outTime format "HH:mm"
    
    // Use provided date or fallback to today
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    const updateData: any = {};
    if (status) updateData.status = status;
    
    if (clearPunchOut) {
      if (slotNo && [1, 2, 3, 4, 5].includes(Number(slotNo))) {
        updateData[`outTime${slotNo}`] = null;
        updateData.outTime = null;
      } else {
        updateData.outTime = null;
        updateData.outTime1 = null;
        updateData.outTime2 = null;
        updateData.outTime3 = null;
        updateData.outTime4 = null;
        updateData.outTime5 = null;
      }
      updateData.status = 'IN';
    }

    const setTime = (timeStr: string) => {
      const [h, m] = timeStr.split(':').map(Number);
      const d = new Date(targetDate);
      d.setHours(h, m, 0, 0);
      return d;
    };

    if (!clearPunchOut) {
      if (slotNo && [1, 2, 3, 4, 5].includes(Number(slotNo))) {
        const sNum = Number(slotNo);
        if (inTime === '') {
          updateData[`inTime${sNum}`] = null;
        } else if (inTime && inTime !== '--') {
          updateData[`inTime${sNum}`] = setTime(inTime);
        }

        if (outTime === '') {
          updateData[`outTime${sNum}`] = null;
        } else if (outTime && outTime !== '--') {
          updateData[`outTime${sNum}`] = setTime(outTime);
        }

        const existing = await prisma.attendance.findUnique({
          where: { userId_date: { userId: Number(traineeId), date: targetDate } }
        });

        // Collate all punch timings across ALL slots (1-5) to compute proper new global mins/maxes!
        const allIns: (Date | null)[] = [];
        const allOuts: (Date | null)[] = [];

        for (let i = 1; i <= 5; i++) {
          let finalI = existing?.[`inTime${i}` as keyof typeof existing] as Date || null;
          let finalO = existing?.[`outTime${i}` as keyof typeof existing] as Date || null;

          if (i === sNum) {
             if (inTime !== undefined) finalI = inTime === '' ? null : setTime(inTime);
             if (outTime !== undefined) finalO = outTime === '' ? null : setTime(outTime);
          }
          allIns.push(finalI);
          allOuts.push(finalO);
        }

        const validIns = allIns.filter(Boolean) as Date[];
        const validOuts = allOuts.filter(Boolean) as Date[];

        updateData.inTime = validIns.length > 0 ? new Date(Math.min(...validIns.map(d => d.getTime()))) : null;
        updateData.outTime = validOuts.length > 0 ? new Date(Math.max(...validOuts.map(d => d.getTime()))) : null;

        if (!updateData.inTime) {
          updateData.status = 'ABSENT';
        } else if (updateData.inTime && !updateData.outTime) {
          updateData.status = 'IN';
        } else {
          updateData.status = 'OUT';
        }
      } else {
        if (inTime === '') {
          updateData.inTime = null;
          updateData.inTime1 = null;
          updateData.inTime2 = null;
          updateData.inTime3 = null;
          updateData.inTime4 = null;
          updateData.inTime5 = null;
        } else if (inTime && inTime !== '--') {
          updateData.inTime = setTime(inTime);
        }

        if (outTime === '') {
          updateData.outTime = null;
          updateData.outTime1 = null;
          updateData.outTime2 = null;
          updateData.outTime3 = null;
          updateData.outTime4 = null;
          updateData.outTime5 = null;
        } else if (outTime && outTime !== '--') {
          updateData.outTime = setTime(outTime);
        }

        const finalIn = inTime !== undefined ? (inTime === '' ? null : setTime(inTime)) : undefined;
        const finalOut = outTime !== undefined ? (outTime === '' ? null : setTime(outTime)) : undefined;

        if (finalIn === null) {
          updateData.status = 'ABSENT';
        } else if (finalIn) {
          if (finalOut === null) {
            updateData.status = 'IN';
          } else if (finalOut) {
            updateData.status = 'OUT';
          } else {
            updateData.status = 'IN';
          }
        }
      }
    }
    if (inTime && inTime !== '--') {
      const user = await prisma.user.findUnique({
        where: { id: Number(traineeId) },
        include: { slots: true }
      });
      const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][targetDate.getDay()];
      const currentDaySlots = user?.slots.filter(s => s.dayOfWeek === dayOfWeek).sort((a, b) => a.slotNo - b.slotNo) || [];
      const sObj = currentDaySlots.find(s => s.slotNo === (slotNo || 1)) || user?.slots.find(s => s.slotNo === (slotNo || 1));
      
      if (sObj) {
        const [sTime, sMod] = sObj.startTime.split(' ');
        let [sh, sm] = sTime.split(':').map(Number);
        if (sMod === 'PM' && sh < 12) sh += 12;
        if (sMod === 'AM' && sh === 12) sh = 0;
        
        const [h, m] = inTime.split(':').map(Number);
        const inMinutes = h * 60 + m;
        const slotStartMinutes = sh * 60 + sm;

        if (inMinutes > slotStartMinutes) {
          updateData.isLate = true;
        } else {
          updateData.isLate = false;
        }
      }
    }

    await prisma.attendance.upsert({
      where: { userId_date: { userId: Number(traineeId), date: targetDate } },
      update: updateData,
      create: {
        userId: Number(traineeId),
        date: targetDate,
        ...updateData,
        status: updateData.status || status || (clearPunchOut ? 'IN' : 'OUT')
      }
    });

    res.json({ message: 'Attendance updated manually' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Holidays Management ──────────────────────────────────────────────────────
router.get('/holidays', async (req: AuthRequest, res) => {
  try {
    const holidays = await prisma.holiday.findMany({
      orderBy: { date: 'asc' }
    });
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/holidays', async (req: AuthRequest, res) => {
  try {
    const { date, name } = req.body;
    if (!date || !name) return res.status(400).json({ error: 'Date and Name are required' });
    
    const holidayDate = new Date(date);
    holidayDate.setHours(0, 0, 0, 0);

    const holiday = await prisma.holiday.create({
      data: { date: holidayDate, name }
    });
    res.json(holiday);
  } catch (error: any) {
    if (error.code === 'P2002') return res.status(400).json({ error: 'Holiday already exists for this date' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/holidays/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.holiday.delete({ where: { id: Number(id) } });
    res.json({ message: 'Holiday deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Institute Settings (Quota) ────────────────────────────────────────────────
router.get('/settings', async (req: AuthRequest, res) => {
  try {
    const settings = await prisma.instituteSettings.findUnique({ where: { id: 1 } });
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', async (req: AuthRequest, res) => {
  try {
    const { totalHolidaysQuota, lat, lng, radius, lat2, lng2, radius2 } = req.body;
    
    // Get existing settings to preserve values
    const existing = await prisma.instituteSettings.findUnique({ where: { id: 1 } });

    const settings = await prisma.instituteSettings.upsert({
      where: { id: 1 },
      update: { 
        totalHolidaysQuota: totalHolidaysQuota !== undefined ? totalHolidaysQuota : existing?.totalHolidaysQuota,
        lat: lat !== undefined ? lat : existing?.lat,
        lng: lng !== undefined ? lng : existing?.lng,
        radius: radius !== undefined ? radius : existing?.radius,
        lat2: lat2 !== undefined ? lat2 : existing?.lat2,
        lng2: lng2 !== undefined ? lng2 : existing?.lng2,
        radius2: radius2 !== undefined ? radius2 : existing?.radius2
      },
      create: { 
        id: 1,
        totalHolidaysQuota: totalHolidaysQuota || 0,
        lat: lat || 12.9716,
        lng: lng || 77.5946,
        radius: radius || 500,
        lat2: lat2 || 12.9716,
        lng2: lng2 || 77.5946,
        radius2: radius2 || 500
      }
    });
    res.json(settings);
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ── Notices Management ────────────────────────────────────────────────────────
router.get('/notices', async (req: AuthRequest, res) => {
  try {
    const notices = await prisma.notice.findMany({
      include: { user: { select: { fullName: true, identifier: true } } },
      orderBy: { createdAt: 'desc' }
    });
    res.json(notices);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/notices', async (req: AuthRequest, res) => {
  try {
    const { message, fromDate, toDate, userId } = req.body;
    if (!message || !fromDate || !toDate) {
      return res.status(400).json({ error: 'Message, fromDate, and toDate are required' });
    }
    
    const notice = await prisma.notice.create({
      data: {
        message,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        userId: userId ? Number(userId) : null
      },
      include: { user: { select: { fullName: true, identifier: true } } }
    });
    res.json(notice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/notices/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.notice.delete({ where: { id: Number(id) } });
    res.json({ message: 'Notice deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/notices/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { message, fromDate, toDate, userId } = req.body;
    if (!message || !fromDate || !toDate) {
      return res.status(400).json({ error: 'Message, fromDate, and toDate are required' });
    }

    const notice = await prisma.notice.update({
      where: { id: Number(id) },
      data: {
        message,
        fromDate: new Date(fromDate),
        toDate: new Date(toDate),
        userId: userId ? Number(userId) : null
      },
      include: { user: { select: { fullName: true, identifier: true } } }
    });
    res.json(notice);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/user/:id/grant-edit', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    // Set editAccessGrantedUntil to 24 hours from now
    const editAccessGrantedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { editAccessGrantedUntil }
    });
    res.json({ message: 'Edit access granted successfully for 24 hours', user });
  } catch (error) {
    console.error('Grant edit error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Dropdown options management
router.get('/options', async (req: AuthRequest, res) => {
  try {
    const options = await prisma.dropdownOption.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(options);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/options', async (req: AuthRequest, res) => {
  try {
    const { type, value } = req.body;
    if (!type || !value) return res.status(400).json({ error: 'Type and value are required' });
    
    const option = await prisma.dropdownOption.create({
      data: { type, value }
    });
    res.json(option);
  } catch (error: any) {
    console.error(error);
    if (error.code === 'P2002') return res.status(400).json({ error: 'Option already exists' });
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/options/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.dropdownOption.delete({ where: { id: Number(id) } });
    res.json({ message: 'Option deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/allow-all-edit-24h', async (req: AuthRequest, res) => {
  try {
    const editAccessGrantedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await prisma.user.updateMany({
      where: { role: 'TRAINEE' },
      data: { editAccessGrantedUntil }
    });
    res.json({ message: 'All trainees have been granted edit access for 24 hours', until: editAccessGrantedUntil });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Dynamic Branch Locations ───────────────────────────────────────────────────
router.get('/branches', async (req: AuthRequest, res) => {
  try {
    const branches = await prisma.branchLocation.findMany({ orderBy: { name: 'asc' } });
    res.json(branches);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/branches', async (req: AuthRequest, res) => {
  try {
    const { name, lat, lng, radius } = req.body;
    if (!name || !lat || !lng) return res.status(400).json({ error: 'Missing required branch fields' });
    
    const branch = await prisma.branchLocation.upsert({
      where: { name: name.trim().toUpperCase() },
      update: {
        lat: Number(lat),
        lng: Number(lng),
        radius: Number(radius || 100)
      },
      create: {
        name: name.trim().toUpperCase(),
        lat: Number(lat),
        lng: Number(lng),
        radius: Number(radius || 100)
      }
    });
    res.json(branch);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/branches/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await prisma.branchLocation.delete({ where: { id: Number(id) } });
    res.json({ message: 'Branch deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

