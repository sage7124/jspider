"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
router.post('/register', async (req, res) => {
    try {
        const { fullName, email, mobile, department, password, photoUrl, officeTimings, dateOfJoining, aadhaarNumber, aadhaarPhotoUrl, panNumber, panPhotoUrl, bankName, bankAccountNo, bankIfscCode, bankBranchName, emergencyContactName, emergencyContactMobile, fatherName, motherName, presentAddress, permanentAddress, educationCompleted, subClassification } = req.body;
        // Check if user exists
        const existingUser = await prisma.user.findFirst({
            where: {
                OR: [{ email }, { identifier: mobile }]
            }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 10);
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
    }
    catch (error) {
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
        const isValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = jsonwebtoken_1.default.sign({ id: user.id, role: user.role, fullName: user.fullName }, JWT_SECRET, { expiresIn: '24h' });
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
                    const inT = recentAtt[`inTime${i}`];
                    const outT = recentAtt[`outTime${i}`];
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
    }
    catch (error) {
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
router.get('/notices', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/profile', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
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
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // Calculate edit eligibility:
        // 1. Within 3 days of registration (createdAt + 72 hours)
        // 2. Or editAccessGrantedUntil is in the future
        const now = new Date();
        const registrationLimit = new Date(user.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
        const isWithin3Days = now < registrationLimit;
        const isOverrideValid = user.editAccessGrantedUntil ? now < new Date(user.editAccessGrantedUntil) : false;
        const canEdit = isWithin3Days || isOverrideValid;
        res.json({ user, canEdit, registrationLimit, overrideLimit: user.editAccessGrantedUntil });
    }
    catch (error) {
        console.error('Error fetching profile:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/profile', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const user = await prisma.user.findUnique({
            where: { id: userId }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // Validate edit lock
        const now = new Date();
        const registrationLimit = new Date(user.createdAt.getTime() + 3 * 24 * 60 * 60 * 1000);
        const isWithin3Days = now < registrationLimit;
        const isOverrideValid = user.editAccessGrantedUntil ? now < new Date(user.editAccessGrantedUntil) : false;
        const canEdit = isWithin3Days || isOverrideValid;
        if (!canEdit) {
            return res.status(403).json({ error: 'Profile editing period has expired. Please contact Admin.' });
        }
        const { fullName, email, photoUrl, officeTimings, dateOfJoining, aadhaarNumber, aadhaarPhotoUrl, panNumber, panPhotoUrl, bankName, bankAccountNo, bankIfscCode, bankBranchName, emergencyContactName, emergencyContactMobile, fatherName, motherName, presentAddress, permanentAddress, educationCompleted, subClassification } = req.body;
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
    }
    catch (error) {
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
    }
    catch (error) {
        console.error('Error fetching dropdown options:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Static QR Code & Public Inquiry Endpoints ────────────────────────────────
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const qrFilePath = path_1.default.join(__dirname, '../../static_qr.json');
const inquiriesFilePath = path_1.default.join(__dirname, '../../qr_inquiries.json');
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
    }
    catch (err) {
        console.error('Error reading static QR from DB:', err);
    }
    try {
        if (fs_1.default.existsSync(qrFilePath)) {
            return JSON.parse(fs_1.default.readFileSync(qrFilePath, 'utf-8'));
        }
    }
    catch (err) { }
    return { token: 'NICT_STATIC_QR_1001', updatedAt: new Date().toISOString() };
};
// Public Static QR endpoint
router.get('/public/static-qr', async (req, res) => {
    try {
        const qrData = await getStaticQRTokenHelper();
        res.json(qrData);
    }
    catch (error) {
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
        let newInquiry = null;
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
        }
        catch (dbErr) {
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
            let inquiries = [];
            if (fs_1.default.existsSync(inquiriesFilePath)) {
                try {
                    inquiries = JSON.parse(fs_1.default.readFileSync(inquiriesFilePath, 'utf-8'));
                }
                catch (e) { }
            }
            inquiries.unshift(newInquiry);
            fs_1.default.writeFileSync(inquiriesFilePath, JSON.stringify(inquiries, null, 2));
        }
        catch (fErr) { }
        res.status(201).json({
            message: 'Inquiry submitted successfully',
            inquiry: newInquiry
        });
    }
    catch (error) {
        console.error('Error saving QR inquiry:', error);
        res.status(500).json({ error: 'Failed to save inquiry details' });
    }
});
// Public PDF Download with Attachment Header for Native iOS & Android File Download
router.get('/public/qr-inquiry/download-pdf', async (req, res) => {
    try {
        const { id, name, mobile, education, preference } = req.query;
        const { default: jsPDF } = await Promise.resolve().then(() => __importStar(require('jspdf')));
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const primaryColor = [25, 118, 210];
        const darkText = [30, 41, 59];
        const lightBg = [241, 245, 249];
        // Header Background Banner
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 38, 'F');
        // Header Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('NICT COMPUTER EDUCATION', 105, 16, { align: 'center' });
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Candidate Inquiry & Qualification Record', 105, 25, { align: 'center' });
        doc.setFontSize(9);
        doc.text('Official Digital Copy • Verified QR Candidate Submission', 105, 32, { align: 'center' });
        // Document Body Title
        doc.setTextColor(darkText[0], darkText[1], darkText[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('CANDIDATE DETAILS SUMMARY', 15, 52);
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.8);
        doc.line(15, 55, 195, 55);
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.roundedRect(15, 62, 180, 95, 3, 3, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(15, 62, 180, 95, 3, 3, 'D');
        const fields = [
            { label: 'Inquiry Reference ID:', value: String(id || 'N/A') },
            { label: 'Candidate Full Name:', value: String(name || 'N/A') },
            { label: 'Mobile / Phone Number:', value: String(mobile || 'N/A') },
            { label: 'Qualification:', value: String(education || 'N/A') },
            { label: 'NICT Preference Center:', value: String(preference || 'NICT Jayanagar Center') },
            { label: 'Date & Time of Submission:', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
            { label: 'Verification Status:', value: 'Verified via QR Scan' }
        ];
        let currentY = 74;
        fields.forEach((f, idx) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(darkText[0], darkText[1], darkText[2]);
            doc.text(f.label, 22, currentY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(f.value, 82, currentY);
            if (idx < fields.length - 1) {
                doc.setDrawColor(226, 232, 240);
                doc.line(22, currentY + 3, 188, currentY + 3);
            }
            currentY += 12;
        });
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(15, 168, 180, 25, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 58, 138);
        doc.text('OFFICIAL VERIFICATION STATEMENT', 22, 176);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text('This document verifies that the candidate has scanned the official NICT QR Code and registered their details into the system.', 22, 184);
        doc.setDrawColor(203, 213, 225);
        doc.line(135, 235, 185, 235);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text('Authorized Signature', 160, 240, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('NICT Administration', 160, 245, { align: 'center' });
        doc.setDrawColor(203, 213, 225);
        doc.line(15, 275, 195, 275);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('NICT Computer Education • Generated automatically on candidate QR scan', 105, 281, { align: 'center' });
        const pdfBuffer = doc.output('arraybuffer');
        const cleanName = String(name || 'Inquiry').replace(/\s+/g, '_');
        const filename = `NICT_Candidate_${cleanName}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(Buffer.from(pdfBuffer));
    }
    catch (err) {
        console.error('Error serving PDF download:', err);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});
// Inline PDF Viewer Endpoint (for opening PDF directly on Mobile browsers)
router.get('/public/qr-inquiry/view-pdf', async (req, res) => {
    try {
        const { id, name, mobile, education, preference } = req.query;
        const { default: jsPDF } = await Promise.resolve().then(() => __importStar(require('jspdf')));
        const doc = new jsPDF({
            orientation: 'portrait',
            unit: 'mm',
            format: 'a4'
        });
        const primaryColor = [25, 118, 210];
        const darkText = [30, 41, 59];
        const lightBg = [241, 245, 249];
        // Header Background Banner
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(0, 0, 210, 38, 'F');
        // Header Title
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(22);
        doc.text('NICT COMPUTER EDUCATION', 105, 16, { align: 'center' });
        doc.setFontSize(11);
        doc.setFont('helvetica', 'normal');
        doc.text('Candidate Inquiry & Qualification Record', 105, 25, { align: 'center' });
        doc.setFontSize(9);
        doc.text('Official Digital Copy • Verified QR Candidate Submission', 105, 32, { align: 'center' });
        // Document Body Title
        doc.setTextColor(darkText[0], darkText[1], darkText[2]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.text('CANDIDATE DETAILS SUMMARY', 15, 52);
        doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.setLineWidth(0.8);
        doc.line(15, 55, 195, 55);
        doc.setFillColor(lightBg[0], lightBg[1], lightBg[2]);
        doc.roundedRect(15, 62, 180, 95, 3, 3, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.setLineWidth(0.3);
        doc.roundedRect(15, 62, 180, 95, 3, 3, 'D');
        const fields = [
            { label: 'Inquiry Reference ID:', value: String(id || 'N/A') },
            { label: 'Candidate Full Name:', value: String(name || 'N/A') },
            { label: 'Mobile / Phone Number:', value: String(mobile || 'N/A') },
            { label: 'Qualification:', value: String(education || 'N/A') },
            { label: 'NICT Preference Center:', value: String(preference || 'NICT Jayanagar Center') },
            { label: 'Date & Time of Submission:', value: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) },
            { label: 'Verification Status:', value: 'Verified via QR Scan' }
        ];
        let currentY = 74;
        fields.forEach((f, idx) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10.5);
            doc.setTextColor(darkText[0], darkText[1], darkText[2]);
            doc.text(f.label, 22, currentY);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(f.value, 82, currentY);
            if (idx < fields.length - 1) {
                doc.setDrawColor(226, 232, 240);
                doc.line(22, currentY + 3, 188, currentY + 3);
            }
            currentY += 12;
        });
        doc.setFillColor(239, 246, 255);
        doc.setDrawColor(191, 219, 254);
        doc.roundedRect(15, 168, 180, 25, 2, 2, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(30, 58, 138);
        doc.text('OFFICIAL VERIFICATION STATEMENT', 22, 176);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(51, 65, 85);
        doc.text('This document verifies that the candidate has scanned the official NICT QR Code and registered their details into the system.', 22, 184);
        doc.setDrawColor(203, 213, 225);
        doc.line(135, 235, 185, 235);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(71, 85, 105);
        doc.text('Authorized Signature', 160, 240, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('NICT Administration', 160, 245, { align: 'center' });
        doc.setDrawColor(203, 213, 225);
        doc.line(15, 275, 195, 275);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text('NICT Computer Education • Generated automatically on candidate QR scan', 105, 281, { align: 'center' });
        const pdfBuffer = doc.output('arraybuffer');
        const cleanName = String(name || 'Inquiry').replace(/\s+/g, '_');
        const filename = `NICT_Candidate_${cleanName}.pdf`;
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(Buffer.from(pdfBuffer));
    }
    catch (err) {
        console.error('Error serving inline PDF:', err);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});
exports.default = router;
//# sourceMappingURL=auth.js.map