import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { getDistance } from 'geolib';
import bcrypt from 'bcryptjs';
import * as exceljs from 'exceljs';
import { generateTraineeWorksheet, getTraineeReportData } from '../utils/excel';

const router = express.Router();
const prisma = new PrismaClient();

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

    res.json({
      status: attendance?.status || 'OUT',
      inTime: attendance?.inTime,
      outTime: attendance?.outTime,
      slots: slots.map(s => `${s.startTime} - ${s.endTime}`)
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

    const settings = await prisma.instituteSettings.findFirst() || { lat: 12.9716, lng: 77.5946, radius: 500 };
    
    // 1. Verify Device Lock (Allow both Mobile and Laptop)
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isMobile = platform === 'mobile';
    const currentLockedId = isMobile ? user.mobileDeviceId : user.desktopDeviceId;

    if (!currentLockedId) {
      return res.status(403).json({ error: `This ${platform} device is not registered to your account. Please logout and login again.` });
    }

    if (deviceId !== currentLockedId) {
      return res.status(403).json({ error: `Attendance can only be marked from your registered ${platform}.` });
    }

    const distance = getDistance(
      { latitude: lat, longitude: lng },
      { latitude: settings.lat, longitude: settings.lng }
    );

    if (distance > settings.radius) {
      return res.status(403).json({ error: 'You are outside the institute premises.' });
    }

    // 2. QR Token validation removed as requested by user
    /*
    if (!qrToken || qrToken.length < 5) {
      return res.status(400).json({ error: 'Invalid QR Code' });
    }
    */

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const now = new Date();

    // Find all slots for today
    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
    const slots = await prisma.slot.findMany({
      where: { userId, dayOfWeek },
      orderBy: { slotNo: 'asc' }
    });

    let isLate = false;
    if (type === 'IN' && slots.length > 0) {
      let activeSlot = null;
      // Find the first slot whose end time has not passed yet
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

      // If all slots have passed, compare with the last slot
      if (!activeSlot) activeSlot = slots[slots.length - 1];

      // Parse active slot start time
      const [sTime, sMod] = activeSlot.startTime.split(' ');
      let [sh, sm] = sTime.split(':').map(Number);
      if (sMod === 'PM' && sh < 12) sh += 12;
      if (sMod === 'AM' && sh === 12) sh = 0;
      
      const slotStartTime = new Date(today);
      slotStartTime.setHours(sh, sm, 0, 0);

      // Grace period of 15 mins
      if (now.getTime() > slotStartTime.getTime() + 15 * 60 * 1000) {
        isLate = true;
      }
    }

    // Upsert attendance record
    const existing = await prisma.attendance.findUnique({
      where: { userId_date: { userId, date: today } }
    });

    if (type === 'IN') {
      if (existing?.status === 'IN') {
        return res.status(400).json({ error: 'Already punched in' });
      }

      await prisma.attendance.upsert({
        where: { userId_date: { userId, date: today } },
        update: {
          status: 'IN',
          inTime: existing?.inTime || now, // Don't override initial inTime
          isLate: existing ? existing.isLate : isLate
        },
        create: {
          userId,
          date: today,
          status: 'IN',
          inTime: now,
          isLate
        }
      });
    } else {
      if (!existing || existing.status === 'OUT') {
        return res.status(400).json({ error: 'Not punched in' });
      }

      await prisma.attendance.update({
        where: { userId_date: { userId, date: today } },
        data: {
          status: 'OUT',
          outTime: now
        }
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
    generateTraineeWorksheet(ws, user, attendances, y, m, daysInMonth, holidays, leaves);

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

    const reportData = getTraineeReportData(user, attendances, y, m, daysInMonth, holidays, leaves);
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

export default router;
