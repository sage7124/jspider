process.env.TZ = 'Asia/Kolkata';
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth';
import attendanceRoutes from './routes/attendance';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Error:', err);
  res.status(500).json({ 
    error: 'Internal server error', 
    message: err.message 
  });
});

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function updatePreviousLateRecords() {
  try {
    const attendances = await prisma.attendance.findMany({
      include: {
        user: {
          include: {
            slots: true
          }
        }
      }
    });

    for (const att of attendances) {
      if (!att.user) continue;

      const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(att.date).getDay()];
      const userSlots = att.user.slots.filter(s => s.dayOfWeek === dayOfWeek).sort((a, b) => a.slotNo - b.slotNo);
      
      let matchTime: Date | null = null;
      let slotStartTimeStr: string | null = null;

      if (att.inTime1) {
        matchTime = att.inTime1;
        const s = userSlots.find(slot => slot.slotNo === 1) || att.user.slots.find(slot => slot.slotNo === 1);
        if (s) slotStartTimeStr = s.startTime;
      } else if (att.inTime2) {
        matchTime = att.inTime2;
        const s = userSlots.find(slot => slot.slotNo === 2) || att.user.slots.find(slot => slot.slotNo === 2);
        if (s) slotStartTimeStr = s.startTime;
      } else if (att.inTime3) {
        matchTime = att.inTime3;
        const s = userSlots.find(slot => slot.slotNo === 3) || att.user.slots.find(slot => slot.slotNo === 3);
        if (s) slotStartTimeStr = s.startTime;
      } else if (att.inTime) {
        matchTime = att.inTime;
        const s = userSlots[0] || att.user.slots[0];
        if (s) slotStartTimeStr = s.startTime;
      }

      if (matchTime && slotStartTimeStr) {
        const [sTime, sMod] = slotStartTimeStr.split(' ');
        let [sh, sm] = sTime.split(':').map(Number);
        if (sMod === 'PM' && sh < 12) sh += 12;
        if (sMod === 'AM' && sh === 12) sh = 0;

        const slotStart = new Date(att.date);
        slotStart.setHours(sh, sm, 0, 0);

        const isLate = matchTime.getTime() > slotStart.getTime();

        if (att.isLate !== isLate) {
          await prisma.attendance.update({
            where: { id: att.id },
            data: { isLate }
          });
        }
      }
    }
    console.log('Successfully re-evaluated isLate on all previous records.');
  } catch (err) {
    console.error('Error updating previous late records:', err);
  }
}

updatePreviousLateRecords();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
