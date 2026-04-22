import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/authMiddleware';
import bcrypt from 'bcryptjs';
import * as exceljs from 'exceljs';

const router = express.Router();
const prisma = new PrismaClient();

router.use(authenticateToken);
router.use(requireAdmin);

// ── GET all trainees with today's attendance ──────────────────────────────────
router.get('/attendance', async (_req: AuthRequest, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const users = await prisma.user.findMany({
      where: { role: 'TRAINEE' },
      include: {
        slots: { orderBy: [{ dayOfWeek: 'asc' }, { slotNo: 'asc' }] },
        attendances: { where: { date: today } },
      },
    });

    const result = users.map((user) => {
      const attendance = user.attendances[0];
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
        status: attendance?.status || 'ABSENT',
        date: today.toLocaleDateString('en-IN'),
        in: attendance?.inTime
          ? new Date(attendance.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '--',
        out: attendance?.outTime
          ? new Date(attendance.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : '--',
        isLate: attendance?.isLate || false,
        isApproved: user.isApproved,
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
    const { fullName, identifier, email } = req.body;
    const user = await prisma.user.update({
      where: { id: Number(id) },
      data: { fullName, identifier, email },
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
    const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const hashed = await bcrypt.hash(user.identifier, 10);
    await prisma.user.update({ where: { id: Number(req.params.id) }, data: { password: hashed } });
    res.json({ message: `Password has been reset to their mobile number: ${user.identifier}` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Download Monthly Excel Report ─────────────────────────────────────────────
router.get('/reports/monthly', async (req: AuthRequest, res) => {
  try {
    const { month } = req.query; // e.g., "2026-04"

    let dateFilter: any = {};
    if (month && typeof month === 'string') {
      const [year, mon] = (month as string).split('-').map(Number);
      const start = new Date(year, mon - 1, 1);
      const end = new Date(year, mon, 0, 23, 59, 59);
      dateFilter = { date: { gte: start, lte: end } };
    }

    const workbook = new exceljs.Workbook();
    workbook.creator = 'Attendance System';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Attendance Report');
    ws.columns = [
      { header: 'Emp Code', key: 'empCode', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Department', key: 'dept', width: 20 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'In Time', key: 'inTime', width: 15 },
      { header: 'Out Time', key: 'outTime', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Late', key: 'isLate', width: 10 },
    ];

    // Style header row
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    const attendances = await prisma.attendance.findMany({
      where: dateFilter,
      include: { user: true },
      orderBy: [{ date: 'asc' }, { user: { fullName: 'asc' } }],
    });

    // If no attendances for month, still include all trainees as ABSENT
    if (attendances.length === 0) {
      const trainees = await prisma.user.findMany({ where: { role: 'TRAINEE' } });
      trainees.forEach((t) => {
        ws.addRow({
          empCode: t.identifier,
          name: t.fullName,
          dept: t.department || '--',
          date: month ? `${month}` : '--',
          inTime: '--',
          outTime: '--',
          status: 'ABSENT',
          isLate: 'No',
        });
      });
    } else {
      attendances.forEach((att) => {
        ws.addRow({
          empCode: att.user.identifier,
          name: att.user.fullName,
          dept: att.user.department || '--',
          date: att.date.toLocaleDateString('en-IN'),
          inTime: att.inTime ? att.inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
          outTime: att.outTime ? att.outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
          status: att.status,
          isLate: att.isLate ? 'Yes' : 'No',
        });
      });
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
    const userId = parseInt(req.params.userId);
    const { month } = req.query; // e.g., "2026-04"

    if (!month || typeof month !== 'string') {
      return res.status(400).json({ error: 'Month is required' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { slots: true }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const [year, mon] = (month as string).split('-').map(Number);
    const startOfMonth = new Date(year, mon - 1, 1);
    const endOfMonth = new Date(year, mon, 0, 23, 59, 59);

    const attendances = await prisma.attendance.findMany({
      where: {
        userId,
        date: { gte: startOfMonth, lte: endOfMonth }
      },
      orderBy: { date: 'asc' }
    });

    const workbook = new exceljs.Workbook();
    const ws = workbook.addWorksheet(`${user.fullName} Report`);

    ws.columns = [
      { header: 'SI No', key: 'si', width: 8 },
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Emp Code', key: 'empCode', width: 15 },
      { header: 'Name', key: 'name', width: 25 },
      { header: 'Department', key: 'dept', width: 20 },
      { header: 'In Time', key: 'inTime', width: 15 },
      { header: 'Out Time', key: 'outTime', width: 15 },
      { header: 'Slot-1 Start', key: 's1Start', width: 15 },
      { header: 'Slot-1 End', key: 's1End', width: 15 },
      { header: 'Worked Hours', key: 'worked', width: 15 },
      { header: 'Late Time', key: 'late', width: 15 },
      { header: 'Status', key: 'status', width: 15 }
    ];

    ws.getRow(1).font = { bold: true };

    const daysInMonth = endOfMonth.getDate();
    let totalWorkedMinutes = 0;
    let totalLateMinutes = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(year, mon - 1, day);
      const dayStr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][currentDate.getDay()];
      
      const daySlots = user.slots.filter(s => s.dayOfWeek === dayStr).sort((a,b) => a.slotNo - b.slotNo);
      const att = attendances.find(a => a.date.getDate() === day && a.date.getMonth() === (mon - 1));

      let workedHours = '--';
      let lateTime = '--';
      let status = '';

      if (daySlots.length === 0) {
        status = 'No Schedule';
      } else if (!att) {
        status = 'ABSENT';
      } else {
        status = att.status === 'IN' ? 'STILL IN' : 'PRESENT';
        
        if (att.inTime && att.outTime) {
          const diff = att.outTime.getTime() - att.inTime.getTime();
          const mins = Math.floor(diff / 60000);
          totalWorkedMinutes += mins;
          workedHours = `${Math.floor(mins / 60)}h ${mins % 60}m`;
        }

        const firstSlot = daySlots[0];
        if (att.inTime && firstSlot) {
          const [time, mod] = firstSlot.startTime.split(' ');
          let [h, m] = time.split(':').map(Number);
          if (mod === 'PM' && h < 12) h += 12;
          if (mod === 'AM' && h === 12) h = 0;
          
          const slotStart = new Date(currentDate);
          slotStart.setHours(h, m, 0, 0);

          if (att.inTime.getTime() > slotStart.getTime()) {
            const diff = att.inTime.getTime() - slotStart.getTime();
            const mins = Math.floor(diff / 60000);
            totalLateMinutes += mins;
            lateTime = `${Math.floor(mins / 60)}h ${mins % 60}m`;
          } else {
            lateTime = '0m';
          }
        }
      }

      ws.addRow({
        si: day,
        date: currentDate.toLocaleDateString('en-IN'),
        empCode: day === 1 ? user.identifier : '',
        name: day === 1 ? user.fullName : '',
        dept: day === 1 ? (user.department || '--') : '',
        inTime: att?.inTime ? att.inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        outTime: att?.outTime ? att.outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
        s1Start: daySlots[0]?.startTime || '--',
        s1End: daySlots[0]?.endTime || '--',
        worked: workedHours,
        late: lateTime,
        status: status
      });
    }

    // Add total row
    const totalRow = ws.addRow({
      si: 'TOTAL',
      worked: `${Math.floor(totalWorkedMinutes / 60)}h ${totalWorkedMinutes % 60}m`,
      late: `${Math.floor(totalLateMinutes / 60)}h ${totalLateMinutes % 60}m`
    });
    totalRow.font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Report_${user.fullName}_${month}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ── Settings ──────────────────────────────────────────────────────────────────
router.get('/settings', async (_req: AuthRequest, res) => {
  try {
    let settings = await prisma.instituteSettings.findFirst();
    if (!settings) {
      settings = await prisma.instituteSettings.create({
        data: { lat: 12.9716, lng: 77.5946, radius: 500 },
      });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.put('/settings', async (req: AuthRequest, res) => {
  try {
    const { lat, lng, radius } = req.body;
    const settings = await prisma.instituteSettings.findFirst();
    if (settings) {
      await prisma.instituteSettings.update({
        where: { id: settings.id },
        data: { lat: Number(lat), lng: Number(lng), radius: Number(radius) },
      });
    } else {
      await prisma.instituteSettings.create({
        data: { lat: Number(lat), lng: Number(lng), radius: Number(radius) },
      });
    }
    res.json({ message: 'Settings updated' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update settings' });
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
    await prisma.user.delete({ where: { id: Number(id) } });
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
