import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { getDistance } from 'geolib';
import bcrypt from 'bcryptjs';
import * as exceljs from 'exceljs';
import { generateTraineeWorksheet, getTraineeReportData } from '../utils/excel';

const router = express.Router();
const prisma = new PrismaClient();

// Helper functions for parsing and calculating duration of 12-hour formatted times
function parse12HourTimeToMinutes(timeStr: string): number {
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1]);
  const minutes = parseInt(match[2]);
  const ampm = match[3].toUpperCase();
  
  if (ampm === 'PM' && hours < 12) {
    hours += 12;
  }
  if (ampm === 'AM' && hours === 12) {
    hours = 0;
  }
  return hours * 60 + minutes;
}

function calculateDifferenceInHours(fromTime: string, toTime: string): string {
  const fromMins = parse12HourTimeToMinutes(fromTime);
  const toMins = parse12HourTimeToMinutes(toTime);
  const diff = toMins >= fromMins ? toMins - fromMins : (toMins + 1440) - fromMins;
  return (diff / 60).toFixed(2);
}

// Institute coordinates (mocking these for now, can be stored in DB later)
const INSTITUTE_LAT = 12.9716;
const INSTITUTE_LNG = 77.5946;
const MAX_DISTANCE_METERS = 500; // 500 meters geofence

router.get('/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } }
    });

    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][today.getDay()];
    const slots = await prisma.slot.findMany({
      where: { userId, dayOfWeek },
      orderBy: { slotNo: 'asc' }
    });

    const recentAtt = await prisma.attendance.findFirst({
      where: { userId, date: { lt: today } },
      orderBy: { date: 'desc' }
    });
    let forgotPunchOut = false;
    if (recentAtt) {
      // Check if any punched slot failed to record corresponding punch out
      for (let i = 1; i <= 5; i++) {
        const inT = recentAtt[`inTime${i}` as keyof typeof recentAtt];
        const outT = recentAtt[`outTime${i}` as keyof typeof recentAtt];
        if (inT && !outT) {
          forgotPunchOut = true;
          break;
        }
      }
    }

    const todayBreaks = await prisma.breakLog.findMany({
      where: { userId, date: today },
      orderBy: { breakOut: 'asc' }
    });
    const activeBreak = todayBreaks.find(b => b.status === 'APPROVED' && b.breakIn === null) || null;
    const pendingBreak = todayBreaks.find(b => b.status === 'PENDING') || null;
    const currentlyOnBreak = activeBreak !== null;
    const breakPending = pendingBreak !== null;
    const approvedBreaks = todayBreaks.filter(b => b.status === 'APPROVED');

    res.json({
      status: attendance?.status || 'OUT',
      inTime: attendance?.inTime,
      outTime: attendance?.outTime,
      forgotPunchOut,
      slots: slots.map(s => `${s.startTime} - ${s.endTime}`),
      currentlyOnBreak,
      breakPending,
      todayBreaksCount: approvedBreaks.length,
      activeBreak,
      pendingBreak,
      completedBreaks: approvedBreaks.filter(b => b.breakIn !== null).map(b => ({
        id: b.id,
        breakOut: b.breakOut,
        breakIn: b.breakIn,
        reason: b.reason,
        bookletNo: b.bookletNo,
        collegeName: b.collegeName,
        subject: b.subject,
        topicsCovered: b.topicsCovered,
        conveyance: b.conveyance,
        numberOfHours: b.numberOfHours,
        fromTime: b.fromTime,
        toTime: b.toTime
      }))
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/punch', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { type, qrToken, lat, lng, deviceId, platform } = req.body;
    const userId = req.user!.id;

    // 1. Verify Geofence
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }

    // Get all dynamically saved Branch Geofences
    const branches = await prisma.branchLocation.findMany();

    // 1. Verify Device Lock (Allow both Mobile and Laptop)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // ── Master Kiosk Bypass ─────────────────────────────────────────────────
    // Check if the trainee is punching from an officially whitelisted reception kiosk PC/Tablet
    const isKioskDevice = (deviceId && typeof deviceId === 'string' && deviceId.trim() !== '') ? await prisma.branchLocation.findFirst({
      where: { kioskDeviceId: deviceId }
    }) : null;

    if (isKioskDevice) {
      console.log(`[Punch] Trusted Master Kiosk detected (${isKioskDevice.name}).`);
    }

    // 🚀 Dynamic Geofence Check for INFINITE LOCATIONS
    if (branches.length === 0) {
      // Fallback to basic check if someone deleted all branches
      return res.status(403).json({ error: 'Institute geolocation boundaries are not set. Please contact Admin.' });
    }

    const validBranch = branches.find(branch => {
      const distance = getDistance(
        { latitude: lat, longitude: lng },
        { latitude: branch.lat, longitude: branch.lng }
      );
      return distance <= branch.radius;
    });

    if (!validBranch) {
      return res.status(403).json({ error: 'You are outside all permitted institute branch premises.' });
    }
    const baseBranchCode = validBranch.branchCode || validBranch.name;
    const punchedBranchName = isKioskDevice ? `${baseBranchCode}, MOBILE` : baseBranchCode;

    // 2. QR Token validation removed as requested by user
    /*
    if (!qrToken || qrToken.length < 5) {
      return res.status(400).json({ error: 'Invalid QR Code' });
    }
    */

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } }
    });

    // Find all slots for today
    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
    let slots = await prisma.slot.findMany({
      where: { userId, dayOfWeek },
      orderBy: { slotNo: 'asc' }
    });

    let isLate = false;
    let activeSlot = null;
    let forwardedSuccessfully = false;

    if (slots.length === 0) {
      const sisterUrl = process.env.SISTER_INSTITUTE_API_URL;
      const secretKey = process.env.CROSS_INSTITUTE_SECRET_KEY;

      if (sisterUrl && secretKey) {
        try {
          const todayDateStr = today.toISOString().split('T')[0];
          const punchTimeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

          const response = await fetch(`${sisterUrl}/api/admin/external-punch`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-cross-secret': secretKey
            },
            body: JSON.stringify({
              identifier: user.identifier,
              punchTime: punchTimeStr,
              type: type === 'IN' ? 'in' : 'out',
              slotNo: 1,
              date: todayDateStr
            })
          });

          if (response.ok) {
            const resData: any = await response.json();
            if (resData && resData.success) {
              forwardedSuccessfully = true;
            }
          }
        } catch (err: any) {
          console.log("Sister institute does not have slot or request failed. Processing punch locally as fallback:", err.message);
        }
      }
    }

    if (forwardedSuccessfully) {
      return res.json({ message: `Successfully punched ${type} (Forwarded to sister institute)` });
    }
    if (slots.length > 0) {
      if (type === 'OUT' && existing) {
        // Find a slot that was punched IN but not punched OUT yet
        for (const s of slots) {
          const hasIn = existing[`inTime${s.slotNo}`];
          const hasOut = existing[`outTime${s.slotNo}`];
          if (hasIn && !hasOut) {
            activeSlot = s;
            break;
          }
        }
      }

      // If no slot matches above or it is an IN punch, fallback to time-based matching
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

      // If all slots have passed, compare with the last slot
      if (!activeSlot) activeSlot = slots[slots.length - 1];

      if (type === 'IN') {
        // Parse active slot start time
        const [sTime, sMod] = activeSlot.startTime.split(' ');
        let [sh, sm] = sTime.split(':').map(Number);
        if (sMod === 'PM' && sh < 12) sh += 12;
        if (sMod === 'AM' && sh === 12) sh = 0;
        
        const slotStartTime = new Date(today);
        slotStartTime.setHours(sh, sm, 0, 0);

        // Grace period removed - even 1 min late is late
        if (now.getTime() > slotStartTime.getTime() && activeSlot.slotNo <= 3) {
          isLate = true;
        }
      }
    }

    const activeSlotNo = activeSlot ? activeSlot.slotNo : 1;

    if (type === 'IN') {
      if (existing?.status === 'IN') {
        return res.status(400).json({ error: 'Already punched in' });
      }

      const dataUpdate: any = {
        status: 'IN',
        inTime: existing?.inTime || now,
        isLate: existing ? existing.isLate : isLate
      };
      if (activeSlotNo === 1) { dataUpdate.inTime1 = now; dataUpdate.inBranch1 = punchedBranchName; }
      if (activeSlotNo === 2) { dataUpdate.inTime2 = now; dataUpdate.inBranch2 = punchedBranchName; }
      if (activeSlotNo === 3) { dataUpdate.inTime3 = now; dataUpdate.inBranch3 = punchedBranchName; }
      if (activeSlotNo === 4) { dataUpdate.inTime4 = now; }
      if (activeSlotNo === 5) { dataUpdate.inTime5 = now; }

      const dataCreate: any = {
        userId,
        date: today,
        status: 'IN',
        inTime: now,
        isLate
      };
      if (activeSlotNo === 1) { dataCreate.inTime1 = now; dataCreate.inBranch1 = punchedBranchName; }
      if (activeSlotNo === 2) { dataCreate.inTime2 = now; dataCreate.inBranch2 = punchedBranchName; }
      if (activeSlotNo === 3) { dataCreate.inTime3 = now; dataCreate.inBranch3 = punchedBranchName; }
      if (activeSlotNo === 4) { dataCreate.inTime4 = now; }
      if (activeSlotNo === 5) { dataCreate.inTime5 = now; }

      await prisma.attendance.upsert({
        where: { userId_date: { userId, date: today } },
        update: dataUpdate,
        create: dataCreate
      });
    } else {
      if (!existing || existing.status === 'OUT') {
        return res.status(400).json({ error: 'Not punched in' });
      }

      const dataUpdate: any = {
        status: 'OUT',
        outTime: now
      };
      if (activeSlotNo === 1) { dataUpdate.outTime1 = now; dataUpdate.outBranch1 = punchedBranchName; }
      if (activeSlotNo === 2) { dataUpdate.outTime2 = now; dataUpdate.outBranch2 = punchedBranchName; }
      if (activeSlotNo === 3) { dataUpdate.outTime3 = now; dataUpdate.outBranch3 = punchedBranchName; }
      if (activeSlotNo === 4) { dataUpdate.outTime4 = now; }
      if (activeSlotNo === 5) { dataUpdate.outTime5 = now; }

      await prisma.attendance.update({
        where: { userId_date: { userId, date: today } },
        data: dataUpdate
      });
    }

    res.json({ message: `Successfully punched ${type}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Trainee Attendance History ────────────────────────────────────────────────
router.get('/history', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const past30Days = new Date();
    past30Days.setDate(past30Days.getDate() - 30);
    
    const attendances = await prisma.attendance.findMany({
      where: { userId, date: { gte: past30Days } },
      orderBy: { date: 'desc' }
    });
    res.json(attendances);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/leave/status', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { leaveBalance: true, totalLeaves: true }
    });
    const requests = await prisma.leaveRequest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json({ balance: user?.leaveBalance, total: user?.totalLeaves, requests });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/change-password', authenticateToken, async (req: AuthRequest, res) => {
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
      combo.info = loc.info || rem.info;
      for(let i = 1; i <= 5; i++) {
        combo[`inTime${i}`] = loc[`inTime${i}`] || rem[`inTime${i}`];
        combo[`outTime${i}`] = loc[`outTime${i}`] || rem[`outTime${i}`];
        combo[`info${i}`] = loc[`info${i}`] || rem[`info${i}`];
      }
      mergedMap.set(key, combo);
    }
  });
  return Array.from(mergedMap.values());
}

router.get('/reports/monthly-excel', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'Month and year required' });
    
    const y = parseInt(year as string);
    const m = parseInt(month as string);
    
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { slots: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0); // Last day of the month
    const daysInMonth = endDate.getDate();

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate }
      }
    });

    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } }
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'APPROVED',
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } }
        ]
      }
    });

    const workbook = new exceljs.Workbook();
    const ws = workbook.addWorksheet(`My Report - ${user.fullName}`);

    let finalAttendances = attendances;
    let finalHolidays = holidays;
    let finalLeaves = leaves;

    // Fetch Sister Data dynamically
    const sister = await fetchSisterReportData(user.identifier, m, y);
    if (sister) {
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
    }

    generateTraineeWorksheet(ws, user, finalAttendances, y, m, daysInMonth, finalHolidays, finalLeaves);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=My_Report_${m}_${y}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reports/monthly-json', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { month, year } = req.query;
    if (!month || !year) return res.status(400).json({ error: 'Month and year required' });
    
    const y = parseInt(year as string);
    const m = parseInt(month as string);
    
    const userId = req.user!.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { slots: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const startDate = new Date(y, m - 1, 1);
    const endDate = new Date(y, m, 0);
    const daysInMonth = endDate.getDate();

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: endDate }
      }
    });

    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: startDate, lte: endDate } }
    });

    const leaves = await prisma.leaveRequest.findMany({
      where: {
        userId,
        status: 'APPROVED',
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } }
        ]
      }
    });

    let finalAttendances = attendances;
    let finalHolidays = holidays;
    let finalLeaves = leaves;

    const sister = await fetchSisterReportData(user.identifier, m, y);
    if (sister) {
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
    }

    const reportData = getTraineeReportData(user, finalAttendances, y, m, daysInMonth, finalHolidays, finalLeaves);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.json(reportData);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.get('/holidays', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const holidays = await prisma.holiday.findMany({
      where: { date: { gte: new Date(new Date().setHours(0,0,0,0)) } },
      orderBy: { date: 'asc' }
    });
    res.json(holidays);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Teacher Break System Endpoints ──────────────────────────────────────────
router.post('/break/out', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { type, bookletNo, collegeName, subject, topicsCovered, conveyance, fromTime, toTime, reason } = req.body;
    const breakType = type || 'NORMAL';

    const attendance = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } }
    });

    if (breakType !== 'COLLEGE_VISIT') {
      if (!attendance || attendance.status !== 'IN') {
        return res.status(400).json({ error: 'You must be Punched In to request a break.' });
      }
    }

    const todayBreaks = await prisma.breakLog.findMany({
      where: { userId, date: today }
    });

    const pendingBreak = todayBreaks.find(b => b.status === 'PENDING');
    if (pendingBreak) {
      return res.status(400).json({ error: 'You already have a pending break request.' });
    }

    const approvedBreaks = todayBreaks.filter(b => b.status === 'APPROVED');
    const activeBreak = approvedBreaks.find(b => b.breakIn === null);
    if (activeBreak) {
      return res.status(400).json({ error: 'You are already on an active break.' });
    }

    if (approvedBreaks.length >= 4) {
      return res.status(400).json({ error: 'Maximum 4 breaks allowed in a day.' });
    }

    let finalStatus = 'APPROVED';
    let finalReason = reason || null;
    let computedHours = null;

    if (breakType === 'NORMAL') {
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Reason for break is required.' });
      }
      finalReason = reason.trim();
    } else if (breakType === 'COLLEGE_VISIT') {
      if (!bookletNo || !collegeName || !subject || !topicsCovered || !conveyance || !fromTime || !toTime) {
        return res.status(400).json({ error: 'All fields (Booklet No, College Name, Subject, Topics Covered, Conveyance Details, From Time, To Time) are required for a College Visit.' });
      }

      // 12-hour format validation (regex matches hh:mm AM/PM, spaces optional)
      const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s*(AM|PM)$/i;
      if (!timeRegex.test(fromTime.trim()) || !timeRegex.test(toTime.trim())) {
        return res.status(400).json({ error: 'Starting and Ending times must be in valid 12-hour format (e.g., 10:00 AM, 02:30 PM).' });
      }

      computedHours = calculateDifferenceInHours(fromTime, toTime);
      finalReason = `College Visit: Booklet No: ${bookletNo.trim()} | College: ${collegeName.trim()} | Subject: ${subject.trim()}`;
    }

    const newBreak = await prisma.breakLog.create({
      data: {
        userId,
        date: today,
        breakOut: new Date(),
        reason: finalReason,
        status: finalStatus,
        bookletNo: breakType === 'COLLEGE_VISIT' ? bookletNo.trim() : null,
        collegeName: breakType === 'COLLEGE_VISIT' ? collegeName.trim() : null,
        subject: breakType === 'COLLEGE_VISIT' ? subject.trim() : null,
        topicsCovered: breakType === 'COLLEGE_VISIT' ? topicsCovered.trim() : null,
        conveyance: breakType === 'COLLEGE_VISIT' ? conveyance.trim() : null,
        fromTime: breakType === 'COLLEGE_VISIT' ? fromTime.trim() : null,
        toTime: breakType === 'COLLEGE_VISIT' ? toTime.trim() : null,
        numberOfHours: computedHours
      }
    });

    const responseMsg = breakType === 'COLLEGE_VISIT'
      ? 'College visit breakout started successfully!'
      : 'Break started successfully! Safe travels.';

    res.status(201).json({ message: responseMsg, breakLog: newBreak });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/break/in', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;
    const { lat, lng } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Find active break first to determine type
    const activeBreak = await prisma.breakLog.findFirst({
      where: { userId, date: today, breakIn: null, status: 'APPROVED' }
    });

    if (!activeBreak) {
      return res.status(400).json({ error: 'No active break session found.' });
    }

    const isCollegeVisit = activeBreak.bookletNo !== null || (activeBreak.reason && activeBreak.reason.startsWith('College Visit:'));

    if (!isCollegeVisit) {
      if (!lat || !lng) {
        return res.status(400).json({ error: 'Location coordinates required to end break.' });
      }

      // Verify Geofence (Confirm arrival back inside premises)
      const branches = await prisma.branchLocation.findMany();
      if (branches.length === 0) {
        return res.status(403).json({ error: 'Institute geolocation boundaries are not set. Contact Admin.' });
      }

      const validBranch = branches.find(branch => {
        const distance = getDistance(
          { latitude: lat, longitude: lng },
          { latitude: branch.lat, longitude: branch.lng }
        );
        return distance <= branch.radius;
      });

      if (!validBranch) {
        return res.status(403).json({ error: 'You are outside all permitted institute branch premises.' });
      }
    }

    // Complete break
    const updatedBreak = await prisma.breakLog.update({
      where: { id: activeBreak.id },
      data: { breakIn: new Date() }
    });

    res.json({ message: 'Welcome back! Break completed successfully.', breakLog: updatedBreak });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
