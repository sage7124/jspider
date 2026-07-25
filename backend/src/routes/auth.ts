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
    const { role, identifier, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { identifier }
    });

    if (!user || user.role !== role) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (!user.isApproved) {
      return res.status(403).json({ error: 'Account pending admin approval' });
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

    let forgotPunchOut = false;
    // For trainees: save the active token so only one session is valid at a time
    if (user.role === 'TRAINEE') {
      await prisma.user.update({
        where: { id: user.id },
        data: { activeSessionToken: token }
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const recentAtt = await prisma.attendance.findFirst({
        where: { userId: user.id, date: { lt: today } },
        orderBy: { date: 'desc' }
      });
      if (recentAtt) {
        for (let i = 1; i <= 5; i++) {
          const inT = recentAtt[`inTime${i}` as keyof typeof recentAtt];
          const outT = recentAtt[`outTime${i}` as keyof typeof recentAtt];
          if (inT && !outT) {
            forgotPunchOut = true;
            break;
          }
        }
      }
    }

    res.json({ 
      token, 
      user: { 
        id: user.id, 
        role: user.role, 
        fullName: user.fullName, 
        permissions: user.permissions,
        isDisabled: user.isDisabled,
        disableReason: user.disableReason,
        hasLeft: user.hasLeft
      }, 
      forgotPunchOut 
    });
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
        permissions: true,
        isDisabled: true,
        disableReason: true,
        hasLeft: true,
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

// ── Static QR Code & Public Inquiry Endpoints ────────────────────────────────
import fs from 'fs';
import path from 'path';

const qrFilePath = path.join(__dirname, '../../static_qr.json');
const inquiriesFilePath = path.join(__dirname, '../../qr_inquiries.json');

const getStaticQRTokenHelper = async () => {
  try {
    const record = await prisma.staticQR.findUnique({ where: { id: 1 } });
    if (record) {
      return { token: record.token, updatedAt: record.updatedAt.toISOString() };
    }
    const created = await prisma.staticQR.create({
      data: { id: 1, token: 'NICT_STATIC_QR_1001' }
    });
    return { token: created.token, updatedAt: created.updatedAt.toISOString() };
  } catch (err) {
    console.error('Error reading static QR from DB:', err);
  }
  try {
    if (fs.existsSync(qrFilePath)) {
      return JSON.parse(fs.readFileSync(qrFilePath, 'utf-8'));
    }
  } catch (err) {}
  return { token: 'NICT_STATIC_QR_1001', updatedAt: new Date().toISOString() };
};

// Public Static QR endpoint
router.get('/public/static-qr', async (req, res) => {
  try {
    const qrData = await getStaticQRTokenHelper();
    res.json(qrData);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch QR token' });
  }
});

// Public QR Inquiry submission
router.post('/public/qr-inquiry', async (req, res) => {
  try {
    const { name, mobile, educationQualification, nictPreference } = req.body;
    if (!name || !mobile || !educationQualification) {
      return res.status(400).json({ error: 'Name, mobile number, and education qualification are required' });
    }

    const qrData = await getStaticQRTokenHelper();
    const inquiryId = 'INQ-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100);
    const pref = nictPreference ? String(nictPreference).trim() : 'NICT Jayanagar Center';

    let newInquiry: any = null;

    try {
      const dbInquiry = await prisma.qRInquiry.create({
        data: {
          inquiryId,
          name: String(name).trim(),
          mobile: String(mobile).trim(),
          educationQualification: String(educationQualification).trim(),
          nictPreference: pref,
          token: qrData.token
        }
      });
      newInquiry = {
        id: dbInquiry.inquiryId,
        name: dbInquiry.name,
        mobile: dbInquiry.mobile,
        educationQualification: dbInquiry.educationQualification,
        nictPreference: dbInquiry.nictPreference,
        submittedAt: dbInquiry.createdAt.toISOString(),
        token: dbInquiry.token
      };
    } catch (dbErr) {
      console.warn('Database save failed for QR inquiry, using fallback:', dbErr);
    }

    if (!newInquiry) {
      newInquiry = {
        id: inquiryId,
        name: String(name).trim(),
        mobile: String(mobile).trim(),
        educationQualification: String(educationQualification).trim(),
        nictPreference: pref,
        submittedAt: new Date().toISOString(),
        token: qrData.token
      };
    }

    // Also write to local file fallback
    try {
      let inquiries: any[] = [];
      if (fs.existsSync(inquiriesFilePath)) {
        try {
          inquiries = JSON.parse(fs.readFileSync(inquiriesFilePath, 'utf-8'));
        } catch (e) {}
      }
      inquiries.unshift(newInquiry);
      fs.writeFileSync(inquiriesFilePath, JSON.stringify(inquiries, null, 2));
    } catch (fErr) {}

    res.status(201).json({
      message: 'Inquiry submitted successfully',
      inquiry: newInquiry
    });
  } catch (error: any) {
    console.error('Error saving QR inquiry:', error);
    res.status(500).json({ error: 'Failed to save inquiry details' });
  }
});

export default router;


