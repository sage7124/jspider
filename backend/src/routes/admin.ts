import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcryptjs';
import * as exceljs from 'exceljs';
import { generateTraineeWorksheet } from '../utils/excel';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireAdmin);

// ── GET all trainees with today's attendance ──────────────────────────────────
router.get('/attendance', async (_req: AuthRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

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

    const result = users.map((user) => {
      const attendance = user.attendances[0];
      const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][today.getDay()];
      const daySlots = user.slots.filter((s) => s.dayOfWeek === dayOfWeek) || [];
      const hasSlot = daySlots.length > 0;

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
        status: attendance?.status || (hasSlot ? 'ABSENT' : '--'),
        date: today.toLocaleDateString('en-IN'),
        in: (() => {
          if (!attendance) return '--';
          const inTimes = [attendance.inTime, attendance.inTime1, attendance.inTime2, attendance.inTime3]
            .filter(t => t)
            .map(t => new Date(t));
          if (inTimes.length === 0) return '--';
          const latest = new Date(Math.max(...inTimes.map(t => t.getTime())));
          return latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        })(),
        out: (() => {
          if (!attendance) return '--';
          const outTimes = [attendance.outTime, attendance.outTime1, attendance.outTime2, attendance.outTime3]
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
    const { fullName, identifier, email, totalLeaves } = req.body;
    const updateData: any = { fullName, identifier, email };
    
    if (totalLeaves !== undefined) {
      updateData.totalLeaves = Number(totalLeaves);
      // If updating total leaves, we usually want to reset/adjust the balance too.
      // For now, let's keep it simple and reset balance to total if total is changed.
      updateData.leaveBalance = Number(totalLeaves);
    }

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
    const { traineeId, startDate, endDate, reason } = req.body;
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: 'Invalid dates' });
    }
    
    const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    const user = await prisma.user.findUnique({ where: { id: Number(traineeId) } });
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (user.leaveBalance < days) {
      return res.status(400).json({ error: `Insufficient leave balance. Remaining: ${user.leaveBalance}` });
    }

    await prisma.$transaction([
      prisma.leaveRequest.create({
        data: {
          userId: Number(traineeId),
          startDate: start,
          endDate: end,
          reason: reason || 'Direct leave by admin',
          status: 'APPROVED',
          adminReason: 'Direct assignment'
        }
      }),
      prisma.user.update({
        where: { id: Number(traineeId) },
        data: { leaveBalance: { decrement: days } }
      })
    ]);

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
          { startDate: { lte: targetDate } },
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

    generateTraineeWorksheet(ws, user, attendances, year, mon, daysInMonth, holidays, leaves);

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
      const days = Math.ceil((finalEndDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (request.user.leaveBalance < days) {
        return res.status(400).json({ error: 'Insufficient leave balance' });
      }

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
      if (slotNo && [1, 2, 3].includes(Number(slotNo))) {
        updateData[`outTime${slotNo}`] = null;
        updateData.outTime = null;
      } else {
        updateData.outTime = null;
        updateData.outTime1 = null;
        updateData.outTime2 = null;
        updateData.outTime3 = null;
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
      if (slotNo && [1, 2, 3].includes(Number(slotNo))) {
        if (inTime && inTime !== '--') updateData[`inTime${slotNo}`] = setTime(inTime);
        if (outTime && outTime !== '--') updateData[`outTime${slotNo}`] = setTime(outTime);
        
        // Also update global in/out if it's the first/last punch of the day
        // For simplicity, we just set the global ones too if they are not set
        const existing = await prisma.attendance.findUnique({
          where: { userId_date: { userId: Number(traineeId), date: targetDate } }
        });
        
        if (inTime && inTime !== '--' && (!existing?.inTime || setTime(inTime) < existing.inTime)) {
          updateData.inTime = setTime(inTime);
        }
        if (outTime && outTime !== '--' && (!existing?.outTime || setTime(outTime) > existing.outTime)) {
          updateData.outTime = setTime(outTime);
        }
      } else {
        if (inTime && inTime !== '--') updateData.inTime = setTime(inTime);
        if (outTime && outTime !== '--') updateData.outTime = setTime(outTime);
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
        status: status || (clearPunchOut ? 'IN' : 'OUT')
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
    const { totalHolidaysQuota, lat, lng, radius } = req.body;
    
    // Get existing settings to preserve values
    const existing = await prisma.instituteSettings.findUnique({ where: { id: 1 } });

    const settings = await prisma.instituteSettings.upsert({
      where: { id: 1 },
      update: { 
        totalHolidaysQuota: totalHolidaysQuota !== undefined ? totalHolidaysQuota : existing?.totalHolidaysQuota,
        lat: lat !== undefined ? lat : existing?.lat,
        lng: lng !== undefined ? lng : existing?.lng,
        radius: radius !== undefined ? radius : existing?.radius
      },
      create: { 
        id: 1,
        totalHolidaysQuota: totalHolidaysQuota || 0,
        lat: lat || 12.9716,
        lng: lng || 77.5946,
        radius: radius || 500
      }
    });
    res.json(settings);
  } catch (error) {
    console.error('Settings update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


export default router;

