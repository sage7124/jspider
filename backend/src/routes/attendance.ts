import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';
import { getDistance } from 'geolib';

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
    const { type, qrToken, lat, lng } = req.body;
    const userId = req.user!.id;

    // 1. Verify Geofence
    if (!lat || !lng) {
      return res.status(400).json({ error: 'Location coordinates required' });
    }

    const settings = await prisma.instituteSettings.findFirst() || { lat: 12.9716, lng: 77.5946, radius: 500 };

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

    // Find assigned slot
    const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
    const slot = await prisma.slot.findFirst({
      where: { userId, dayOfWeek }
    });

    let isLate = false;
    if (type === 'IN' && slot) {
      // Parse slot start time (e.g., "09:00 AM")
      const [time, modifier] = slot.startTime.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      
      const slotStartTime = new Date(today);
      slotStartTime.setHours(hours, minutes, 0, 0);

      // Grace period of 15 mins? We'll just compare exact time
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

export default router;
