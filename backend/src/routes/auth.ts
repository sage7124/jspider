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
    const { 
      fullName, email, mobile, department, password,
      photoUrl, officeTimings, dateOfJoining, aadhaarNumber, aadhaarPhotoUrl,
      panNumber, panPhotoUrl, bankName, bankAccountNo, bankIfscCode, bankBranchName,
      emergencyContactName, emergencyContactMobile, fatherName, motherName,
      presentAddress, permanentAddress, educationCompleted, subClassification
    } = req.body;
    
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
        identifier: mobile,
        department,
        password: hashedPassword,
        isApproved: false,
        photoUrl,
        officeTimings,
        dateOfJoining,
        aadhaarNumber,
        aadhaarPhotoUrl,
        panNumber,
        panPhotoUrl,
        bankName,
        bankAccountNo,
        bankIfscCode,
        bankBranchName,
        emergencyContactName,
        emergencyContactMobile,
        fatherName,
        motherName,
        presentAddress,
        permanentAddress,
        educationCompleted,
        subClassification
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
      // ── Master Kiosk Bypass ─────────────────────────────────────────────────
      // Check if the user is logging in from an officially whitelisted reception kiosk PC/Tablet
      const isKioskDevice = await prisma.branchLocation.findFirst({
        where: { kioskDeviceId: deviceId }
      });

      if (isKioskDevice) {
        // It is a trusted central kiosk! Bypass all user-device fingerprint binds, 
        // allowing unrestricted logins from this physical device WITHOUT altering 
        // the student's personal device configuration.
        console.log(`[Login] Trusted Master Kiosk detected (${isKioskDevice.name}). Locking bypassed.`);
      } else {
        // Proceed with standard strict single-device binding anti-cheat
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

    const d = new Date();
    // Convert to IST to get the correct current date in India
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(d.getTime() + istOffset);
    const todayString = istTime.toISOString().split('T')[0];
    const todayStart = new Date(todayString + 'T00:00:00.000Z');

    const notices = await prisma.notice.findMany({
      where: {
        AND: [
          { fromDate: { lte: todayStart } },
          { toDate: { gte: todayStart } },
          {
            OR: [
              { userId: userId },
              {
                AND: [
                  { userId: null },
                  {
                    targetGroup: {
                      in: ['ALL', req.user?.role || 'TRAINEE']
                    }
                  }
                ]
              }
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

router.get('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        fullName: true,
        identifier: true,
        email: true,
        role: true,
        createdAt: true,
        editAccessGrantedUntil: true,
        photoUrl: true,
        officeTimings: true,
        dateOfJoining: true,
        aadhaarNumber: true,
        aadhaarPhotoUrl: true,
        panNumber: true,
        panPhotoUrl: true,
        bankName: true,
        bankAccountNo: true,
        bankIfscCode: true,
        bankBranchName: true,
        emergencyContactName: true,
        emergencyContactMobile: true,
        fatherName: true,
        motherName: true,
        presentAddress: true,
        permanentAddress: true,
        educationCompleted: true,
        subClassification: true,
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Calculate edit eligibility:
    // 1. Within 3 days of registration (createdAt + 72 hours)
    // 2. Or editAccessGrantedUntil is in the future
    const now = new Date();
    const registrationLimit = new Date(user.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const isWithin3Days = now < registrationLimit;
    const isOverrideValid = user.editAccessGrantedUntil ? now < new Date(user.editAccessGrantedUntil) : false;
    const canEdit = isWithin3Days || isOverrideValid;

    res.json({ user, canEdit, registrationLimit, overrideLimit: user.editAccessGrantedUntil });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', authenticateToken, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Validate edit lock
    const now = new Date();
    const registrationLimit = new Date(user.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
    const isWithin3Days = now < registrationLimit;
    const isOverrideValid = user.editAccessGrantedUntil ? now < new Date(user.editAccessGrantedUntil) : false;
    const canEdit = isWithin3Days || isOverrideValid;

    if (!canEdit) {
      return res.status(403).json({ error: 'Profile editing period has expired. Please contact Admin.' });
    }

    const {
      fullName,
      email,
      photoUrl,
      officeTimings,
      dateOfJoining,
      aadhaarNumber,
      aadhaarPhotoUrl,
      panNumber,
      panPhotoUrl,
      bankName,
      bankAccountNo,
      bankIfscCode,
      bankBranchName,
      emergencyContactName,
      emergencyContactMobile,
      fatherName,
      motherName,
      presentAddress,
      permanentAddress,
      educationCompleted,
      subClassification
    } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName,
        email,
        photoUrl,
        officeTimings,
        dateOfJoining,
        aadhaarNumber,
        aadhaarPhotoUrl,
        panNumber,
        panPhotoUrl,
        bankName,
        bankAccountNo,
        bankIfscCode,
        bankBranchName,
        emergencyContactName,
        emergencyContactMobile,
        fatherName,
        motherName,
        presentAddress,
        permanentAddress,
        educationCompleted,
        subClassification
      }
    });

    res.json({ message: 'Profile updated successfully', user: updatedUser });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/dropdown-options', async (req, res) => {
  try {
    let options = await prisma.dropdownOption.findMany();
    
    // Self-healing seed if empty
    if (options.length === 0) {
      const defaultOptions = [
        { type: 'EDUCATION', value: 'Undergraduate' },
        { type: 'EDUCATION', value: 'Postgraduate' },
        { type: 'EDUCATION', value: 'Diploma' },
        { type: 'EDUCATION', value: 'Doctorate' },
        { type: 'CLASSIFICATION', value: 'Full-time' },
        { type: 'CLASSIFICATION', value: 'Part-time' },
        { type: 'CLASSIFICATION', value: 'Contract' },
        { type: 'CLASSIFICATION', value: 'Temporary' }
      ];
      await prisma.dropdownOption.createMany({ data: defaultOptions });
      options = await prisma.dropdownOption.findMany();
    }

    const educations = options.filter(o => o.type === 'EDUCATION').map(o => o.value);
    const classifications = options.filter(o => o.type === 'CLASSIFICATION').map(o => o.value);

    res.json({ educations, classifications });
  } catch (error) {
    console.error('Error fetching dropdown options:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
