import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';

const router = express.Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';

router.post('/register', async (req, res) => {
  try {
    const { fullName, email, mobile, department, password } = req.body;
    
    // Check if user exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { identifier: mobile }]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        role: 'TRAINEE',
        fullName,
        email,
        identifier: mobile, // Using mobile as identifier for registration
        department,
        password: hashedPassword,
        isApproved: false, // Explicitly false
      }
    });

    res.status(201).json({ message: 'Registration successful. Waiting for Admin approval.' });
  } catch (error: any) {
    console.error('Registration error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A user with this email or mobile already exists' });
    }
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { role, identifier, password, deviceId, platform } = req.body;

    const user = await prisma.user.findUnique({
      where: { identifier }
    });

    if (!user || user.role !== role) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isApproved) {
      return res.status(403).json({ error: 'Account pending admin approval' });
    }

    // Device Locking Logic for Trainees
    if (role === 'TRAINEE' && deviceId) {
      const isMobile = platform === 'mobile';
      const currentLockedId = isMobile ? user.mobileDeviceId : user.desktopDeviceId;

      if (!currentLockedId) {
        // Check if this deviceId is already taken by ANY OTHER user
        const otherUserWithDevice = await prisma.user.findFirst({
          where: {
            OR: [
              { mobileDeviceId: deviceId },
              { desktopDeviceId: deviceId }
            ],
            NOT: { id: user.id }
          }
        });

        if (otherUserWithDevice) {
          return res.status(403).json({ 
            error: 'This device is already associated with another account. Please contact Admin to clear it.' 
          });
        }

        // First login on this platform, lock it
        await prisma.user.update({
          where: { id: user.id },
          data: isMobile ? { mobileDeviceId: deviceId } : { desktopDeviceId: deviceId }
        });
      } else if (currentLockedId !== deviceId) {
        return res.status(403).json({ 
          error: `This account is locked to another ${platform} device. Please contact Admin to reset.` 
        });
      }
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role, fullName: user.fullName },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, role: user.role, fullName: user.fullName } });
  } catch (error: any) {
    console.error('Login error:', error);
    
    // Specific handling for Prisma unique constraint errors (P2002)
    // This happens if a deviceId is already locked to another user
    if (error.code === 'P2002') {
      const targets = error.meta?.target || [];
      if (targets.includes('mobileDeviceId') || targets.includes('desktopDeviceId')) {
        return res.status(403).json({ 
          error: 'This device is already associated with another account. Please contact Admin.' 
        });
      }
    }

    res.status(500).json({ 
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined 
    });
  }
});

router.get('/notices', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const notices = await prisma.notice.findMany({
      where: {
        AND: [
          { fromDate: { lte: today } },
          { toDate: { gte: today } },
          {
            OR: [
              { userId: null },
              { userId: userId }
            ]
          }
        ]
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(notices);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
