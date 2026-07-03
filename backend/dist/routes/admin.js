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
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const exceljs = __importStar(require("exceljs"));
const excel_1 = require("../utils/excel");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// ── Cross-Institute Internal Webhook Handlers (Unsecured from Admin JWT) ────────
// Middleware to verify cross-institute secret key
const verifyCrossSecret = (req, res, next) => {
    const headerSecret = req.headers['x-cross-secret'];
    const expectedSecret = process.env.CROSS_INSTITUTE_SECRET_KEY;
    if (!expectedSecret || headerSecret !== expectedSecret) {
        return res.status(401).json({ error: 'Unauthorized cross-institute access' });
    }
    next();
};
router.post('/external-punch', verifyCrossSecret, async (req, res) => {
    try {
        const { identifier, type } = req.body;
        const user = await prisma.user.findUnique({ where: { identifier } });
        if (!user)
            return res.status(404).json({ error: 'User not found locally' });
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const now = new Date();
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][now.getDay()];
        const slots = await prisma.slot.findMany({ where: { userId: user.id, dayOfWeek }, orderBy: { slotNo: 'asc' } });
        // User has no slot here today! Return error to signal calling institute to fallback to local logging!
        if (slots.length === 0) {
            return res.status(400).json({ error: 'No scheduled slots on this institute for today.' });
        }
        const existing = await prisma.attendance.findUnique({ where: { userId_date: { userId: user.id, date: today } } });
        let activeSlot = null;
        const typeUpper = type.toUpperCase();
        // Simple logical slot determination
        if (typeUpper === 'OUT' && existing) {
            for (const s of slots) {
                if (existing[`inTime${s.slotNo}`] && !existing[`outTime${s.slotNo}`]) {
                    activeSlot = s;
                    break;
                }
            }
        }
        if (!activeSlot) {
            for (const s of slots) {
                const [eTime, eMod] = s.endTime.split(' ');
                let [eh, em] = eTime.split(':').map(Number);
                if (eMod === 'PM' && eh < 12)
                    eh += 12;
                if (eMod === 'AM' && eh === 12)
                    eh = 0;
                const slotEnd = new Date(today);
                slotEnd.setHours(eh, em, 0, 0);
                if (now.getTime() <= slotEnd.getTime()) {
                    activeSlot = s;
                    break;
                }
            }
        }
        if (!activeSlot)
            activeSlot = slots[slots.length - 1];
        if (typeUpper === 'OUT' && slots.length >= 2 && activeSlot) {
            const sortedSlots = [...slots].sort((a, b) => {
                const parseTime = (timeStr) => {
                    const [tStr, mod] = timeStr.split(' ');
                    let [h, m] = tStr.split(':').map(Number);
                    if (mod === 'PM' && h < 12)
                        h += 12;
                    if (mod === 'AM' && h === 12)
                        h = 0;
                    const d = new Date(today);
                    d.setHours(h, m, 0, 0);
                    return d;
                };
                return parseTime(a.startTime).getTime() - parseTime(b.startTime).getTime();
            });
            const activeIndex = sortedSlots.findIndex(s => s.id === activeSlot.id);
            if (activeIndex !== -1 && activeIndex < sortedSlots.length - 1) {
                const nextSlot = sortedSlots[activeIndex + 1];
                const parseTime = (timeStr) => {
                    const [tStr, mod] = timeStr.split(' ');
                    let [h, m] = tStr.split(':').map(Number);
                    if (mod === 'PM' && h < 12)
                        h += 12;
                    if (mod === 'AM' && h === 12)
                        h = 0;
                    const d = new Date(today);
                    d.setHours(h, m, 0, 0);
                    return d;
                };
                const nextSlotStart = parseTime(nextSlot.startTime);
                const limitTime = new Date(nextSlotStart.getTime() - 5 * 60 * 1000);
                if (now.getTime() >= limitTime.getTime()) {
                    return res.status(400).json({
                        error: 'You forgot to punch out of your previous slot. Please talk to the admin.'
                    });
                }
            }
        }
        let isLate = false;
        if (typeUpper === 'IN') {
            const [sTime, sMod] = activeSlot.startTime.split(' ');
            let [sh, sm] = sTime.split(':').map(Number);
            if (sMod === 'PM' && sh < 12)
                sh += 12;
            if (sMod === 'AM' && sh === 12)
                sh = 0;
            const slotStartTime = new Date(today);
            slotStartTime.setHours(sh, sm, 0, 0);
            if (now.getTime() > slotStartTime.getTime() && activeSlot.slotNo <= 3)
                isLate = true;
        }
        const activeSlotNo = activeSlot.slotNo;
        if (typeUpper === 'IN') {
            if (existing?.status === 'IN') {
                let currentlyPunchedInSlot = null;
                for (const s of slots) {
                    const hasIn = existing[`inTime${s.slotNo}`];
                    const hasOut = existing[`outTime${s.slotNo}`];
                    if (hasIn && !hasOut) {
                        currentlyPunchedInSlot = s;
                        break;
                    }
                }
                let isForgotBypass = false;
                if (currentlyPunchedInSlot && activeSlot && currentlyPunchedInSlot.slotNo !== activeSlot.slotNo) {
                    isForgotBypass = true;
                }
                if (!isForgotBypass) {
                    return res.json({ success: true, message: 'Already punched in' });
                }
            }
            const updateD = { status: 'IN', inTime: existing?.inTime || now, isLate: existing ? existing.isLate : isLate };
            const createD = { userId: user.id, date: today, status: 'IN', inTime: now, isLate };
            if ([1, 2, 3, 4, 5].includes(activeSlotNo)) {
                updateD[`inTime${activeSlotNo}`] = now;
                updateD[`slotStart${activeSlotNo}`] = activeSlot.startTime;
                updateD[`slotEnd${activeSlotNo}`] = activeSlot.endTime;
                createD[`inTime${activeSlotNo}`] = now;
                createD[`slotStart${activeSlotNo}`] = activeSlot.startTime;
                createD[`slotEnd${activeSlotNo}`] = activeSlot.endTime;
            }
            await prisma.attendance.upsert({ where: { userId_date: { userId: user.id, date: today } }, update: updateD, create: createD });
        }
        else {
            if (!existing || existing.status === 'OUT')
                return res.json({ success: true, message: 'Not punched in' });
            const updateD = { status: 'OUT', outTime: now };
            if ([1, 2, 3, 4, 5].includes(activeSlotNo))
                updateD[`outTime${activeSlotNo}`] = now;
            await prisma.attendance.update({ where: { userId_date: { userId: user.id, date: today } }, data: updateD });
        }
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
router.post('/external-monthly-data', verifyCrossSecret, async (req, res) => {
    try {
        const { identifier, month, year } = req.body;
        const user = await prisma.user.findUnique({ where: { identifier }, include: { slots: true } });
        if (!user)
            return res.json({ success: true, attendances: [], leaves: [], holidays: [], slots: [] });
        const m = parseInt(month);
        const y = parseInt(year);
        const startDate = new Date(y, m - 1, 1);
        const endDate = new Date(y, m, 0);
        const attendances = await prisma.attendance.findMany({
            where: { userId: user.id, date: { gte: startDate, lte: endDate } }
        });
        const leaves = await prisma.leaveRequest.findMany({
            where: { userId: user.id, status: 'APPROVED', OR: [{ startDate: { lte: endDate }, endDate: { gte: startDate } }] }
        });
        const holidays = await prisma.holiday.findMany({
            where: { date: { gte: startDate, lte: endDate } }
        });
        res.json({ success: true, attendances, leaves, holidays, slots: user.slots });
    }
    catch (e) {
        res.status(500).json({ error: e.message });
    }
});
// ── Standard Secured API Endpoints (Require JWT & Admin Privileges) ──────────
router.use(authMiddleware_1.authenticateToken);
// ── Dynamic Multi-Role Sandboxed Access Control Middleware ──────────────────
router.use((req, res, next) => {
    const role = req.user?.role;
    if (role === 'ADMIN') {
        return next(); // Super Admin has full absolute system-level read/write access
    }
    if (role === 'SUPERVISOR') {
        // The Supervisor only gets access to specific operational pathways:
        // 1. View trainees & attendance records
        // 2. View, generate and download monthly reports
        // 3. Reset student passwords
        // 4. Direct, Process and Approve leave requests
        // 5. Create, view and delete notices (targeted announcements)
        // 6. View received memos
        const path = req.path.toLowerCase();
        const allowedPrefixes = [
            '/attendance',
            '/reports',
            '/change-password',
            '/leaves',
            '/notices',
            '/memos',
            '/extra-classes',
            '/classes-cancelled',
            '/class-cancelled',
            '/breaks'
        ];
        const isAllowed = allowedPrefixes.some(p => path.startsWith(p));
        if (isAllowed) {
            return next();
        }
        return res.status(403).json({
            error: 'Access Denied: Supervisors are restricted to Leaves, Reports, Password Resets, Notices, and Memos management only.'
        });
    }
    if (role === 'TRAINEE') {
        // Trainees (Teachers) only get access to fetch their own received memos
        const path = req.path.toLowerCase();
        if (path.startsWith('/memos/received')) {
            return next();
        }
        return res.status(403).json({ error: 'Access Denied: Trainees are restricted from Admin operations.' });
    }
    return res.status(403).json({ error: 'Admin access required' });
});
// ── Cross-Institute Fetcher & Merger Helpers ─────────────────────────────────────
async function fetchSisterReportData(identifier, month, year) {
    const sisterUrl = process.env.SISTER_INSTITUTE_API_URL;
    const secretKey = process.env.CROSS_INSTITUTE_SECRET_KEY;
    if (!sisterUrl || !secretKey)
        return null;
    try {
        const response = await fetch(`${sisterUrl}/api/admin/external-monthly-data`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-cross-secret': secretKey },
            body: JSON.stringify({ identifier, month, year })
        });
        if (!response.ok)
            return null;
        const resData = await response.json();
        return resData.success ? resData : null;
    }
    catch (e) {
        console.log("Sister data fetch error:", e);
        return null;
    }
}
async function broadcastLeaveToSister(payload) {
    const sisterUrl = process.env.SISTER_INSTITUTE_API_URL;
    const secretKey = process.env.CROSS_INSTITUTE_SECRET_KEY;
    if (!sisterUrl || !secretKey)
        return;
    try {
        await fetch(`${sisterUrl}/api/admin/external-leave-push`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-cross-secret': secretKey },
            body: JSON.stringify(payload)
        });
    }
    catch (e) {
        console.log("Leave broadcast failure:", e);
    }
}
router.post('/external-leave-push', verifyCrossSecret, async (req, res) => {
    try {
        const { identifier, startDate, endDate, reason, adminReason, appliedDate, remarksAlternative, remarksOfficeUse } = req.body;
        const user = await prisma.user.findUnique({ where: { identifier } });
        if (!user)
            return res.status(404).json({ success: false, error: 'User unknown on this node' });
        // Replicate the authorized leave instantly without double-dipping leave balances, keeping visual parity!
        await prisma.leaveRequest.create({
            data: {
                userId: user.id,
                startDate: new Date(startDate),
                endDate: new Date(endDate),
                reason: reason || 'Synced Leave',
                status: 'APPROVED',
                adminReason: adminReason || 'Cross-institute Sync',
                appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
                remarksAlternative: remarksAlternative || null,
                remarksOfficeUse: remarksOfficeUse || null
            }
        });
        res.json({ success: true });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
function mergeAttendances(localAtt, remoteAtt) {
    const mergedMap = new Map();
    localAtt.forEach(a => { mergedMap.set(new Date(a.date).toISOString().split('T')[0], { ...a }); });
    remoteAtt.forEach(rem => {
        const key = new Date(rem.date).toISOString().split('T')[0];
        if (!mergedMap.has(key)) {
            mergedMap.set(key, rem);
        }
        else {
            const loc = mergedMap.get(key);
            const combo = { ...loc, ...rem };
            if (loc.inTime && rem.inTime)
                combo.inTime = new Date(loc.inTime) < new Date(rem.inTime) ? loc.inTime : rem.inTime;
            if (loc.outTime && rem.outTime)
                combo.outTime = new Date(loc.outTime) > new Date(rem.outTime) ? loc.outTime : rem.outTime;
            combo.isLate = loc.isLate || rem.isLate;
            combo.status = (loc.status === 'IN' || rem.status === 'IN') ? 'IN' : 'OUT';
            combo.info = loc.info || rem.info;
            for (let i = 1; i <= 5; i++) {
                combo[`info${i}`] = loc[`info${i}`] || rem[`info${i}`];
                const lIn = loc[`inTime${i}`];
                const rIn = rem[`inTime${i}`];
                if (lIn && rIn) {
                    combo[`inTime${i}`] = new Date(lIn) < new Date(rIn) ? lIn : rIn;
                }
                else {
                    combo[`inTime${i}`] = lIn || rIn;
                }
                const lOut = loc[`outTime${i}`];
                const rOut = rem[`outTime${i}`];
                if (lOut && rOut) {
                    combo[`outTime${i}`] = new Date(lOut) > new Date(rOut) ? lOut : rOut;
                }
                else {
                    combo[`outTime${i}`] = lOut || rOut;
                }
            }
            mergedMap.set(key, combo);
        }
    });
    return Array.from(mergedMap.values());
}
// ── GET all trainees with today's attendance ──────────────────────────────────
router.get('/attendance', async (_req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const endOfToday = new Date(today);
        endOfToday.setHours(23, 59, 59, 999);
        const { search } = _req.query;
        const supervisorFilter = _req.user?.role === 'SUPERVISOR' ? { supervisors: { some: { id: _req.user.id } } } : {};
        const users = await prisma.user.findMany({
            where: {
                role: 'TRAINEE',
                hasLeft: false,
                ...supervisorFilter,
                OR: search ? [
                    { fullName: { contains: search, mode: 'insensitive' } },
                    { identifier: { contains: search, mode: 'insensitive' } },
                    { department: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ] : undefined
            },
            orderBy: { fullName: 'asc' },
            include: {
                slots: { orderBy: [{ dayOfWeek: 'asc' }, { slotNo: 'asc' }] },
                attendances: { where: { date: today } },
            },
        });
        const leaves = await prisma.leaveRequest.findMany({
            where: {
                status: 'APPROVED',
                AND: [
                    { startDate: { lte: endOfToday } },
                    { endDate: { gte: today } }
                ]
            }
        });
        const result = users.map((user) => {
            const attendance = user.attendances[0];
            const leave = leaves.find(l => l.userId === user.id);
            const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][today.getDay()];
            const daySlots = user.slots.filter((s) => s.dayOfWeek === dayOfWeek) || [];
            const hasSlot = daySlots.length > 0;
            let status = attendance?.status;
            if (!status) {
                if (leave)
                    status = 'LEAVE';
                else
                    status = hasSlot ? 'ABSENT' : '--';
            }
            if (status === 'ABSENT' && !hasSlot) {
                status = '--';
            }
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
                status,
                date: today.toLocaleDateString('en-IN'),
                in: (() => {
                    if (!attendance)
                        return '--';
                    const inTimes = [attendance.inTime1, attendance.inTime2, attendance.inTime3]
                        .filter(t => t)
                        .map(t => new Date(t));
                    if (inTimes.length === 0)
                        return '--';
                    const latest = new Date(Math.max(...inTimes.map(t => t.getTime())));
                    return latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })(),
                out: (() => {
                    if (!attendance)
                        return '--';
                    const outTimes = [attendance.outTime1, attendance.outTime2, attendance.outTime3]
                        .filter(t => t)
                        .map(t => new Date(t));
                    if (outTimes.length === 0)
                        return '--';
                    const latest = new Date(Math.max(...outTimes.map(t => t.getTime())));
                    if (latest.getHours() === 0 && latest.getMinutes() === 0)
                        return '--';
                    return latest.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })(),
                inTime1: attendance?.inTime1 ? new Date(attendance.inTime1).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime1: attendance?.outTime1 ? (() => {
                    const d = new Date(attendance.outTime1);
                    if (d.getHours() === 0 && d.getMinutes() === 0)
                        return '--';
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })() : '--',
                inTime2: attendance?.inTime2 ? new Date(attendance.inTime2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime2: attendance?.outTime2 ? (() => {
                    const d = new Date(attendance.outTime2);
                    if (d.getHours() === 0 && d.getMinutes() === 0)
                        return '--';
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })() : '--',
                inTime3: attendance?.inTime3 ? new Date(attendance.inTime3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime3: attendance?.outTime3 ? (() => {
                    const d = new Date(attendance.outTime3);
                    if (d.getHours() === 0 && d.getMinutes() === 0)
                        return '--';
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })() : '--',
                isLate: attendance?.isLate || false,
                isApproved: user.isApproved,
                totalLeaves: user.totalLeaves,
                leaveBalance: user.leaveBalance,
                isDisabled: user.isDisabled,
                disableReason: user.disableReason,
                hasLeft: user.hasLeft,
            };
        });
        res.json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── GET pending approvals ─────────────────────────────────────────────────────
router.get('/pending', async (_req, res) => {
    try {
        const pending = await prisma.user.findMany({
            where: { role: 'TRAINEE', isApproved: false },
            select: { id: true, identifier: true, fullName: true, email: true, department: true, createdAt: true },
            orderBy: { fullName: 'asc' }
        });
        res.json(pending);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Approve Trainee ───────────────────────────────────────────────────────────
router.post('/approve', async (req, res) => {
    try {
        const { traineeId } = req.body;
        await prisma.user.update({ where: { id: traineeId }, data: { isApproved: true } });
        res.json({ message: 'Trainee approved successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Edit User Info ────────────────────────────────────────────────────────────
router.put('/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { fullName, identifier, email, totalLeaves, leaveBalance, educationCompleted, subClassification, fatherName, motherName, photoUrl, dateOfJoining, officeTimings, presentAddress, permanentAddress, aadhaarNumber, aadhaarPhotoUrl, panNumber, panPhotoUrl, bankName, bankAccountNo, bankIfscCode, bankBranchName, emergencyContactName, emergencyContactMobile } = req.body;
        const updateData = {};
        if (fullName !== undefined)
            updateData.fullName = fullName;
        if (identifier !== undefined)
            updateData.identifier = String(identifier).replace(/\D/g, '').slice(0, 10);
        if (email !== undefined)
            updateData.email = email === '' ? null : email;
        if (educationCompleted !== undefined)
            updateData.educationCompleted = educationCompleted;
        if (subClassification !== undefined)
            updateData.subClassification = subClassification;
        if (fatherName !== undefined)
            updateData.fatherName = fatherName;
        if (motherName !== undefined)
            updateData.motherName = motherName;
        if (photoUrl !== undefined)
            updateData.photoUrl = photoUrl;
        if (dateOfJoining !== undefined)
            updateData.dateOfJoining = dateOfJoining;
        if (officeTimings !== undefined)
            updateData.officeTimings = officeTimings;
        if (presentAddress !== undefined)
            updateData.presentAddress = presentAddress;
        if (permanentAddress !== undefined)
            updateData.permanentAddress = permanentAddress;
        if (aadhaarNumber !== undefined)
            updateData.aadhaarNumber = aadhaarNumber;
        if (aadhaarPhotoUrl !== undefined)
            updateData.aadhaarPhotoUrl = aadhaarPhotoUrl;
        if (panNumber !== undefined)
            updateData.panNumber = panNumber;
        if (panPhotoUrl !== undefined)
            updateData.panPhotoUrl = panPhotoUrl;
        if (bankName !== undefined)
            updateData.bankName = bankName;
        if (bankAccountNo !== undefined)
            updateData.bankAccountNo = bankAccountNo;
        if (bankIfscCode !== undefined)
            updateData.bankIfscCode = bankIfscCode;
        if (bankBranchName !== undefined)
            updateData.bankBranchName = bankBranchName;
        if (emergencyContactName !== undefined)
            updateData.emergencyContactName = emergencyContactName;
        if (emergencyContactMobile !== undefined)
            updateData.emergencyContactMobile = emergencyContactMobile;
        if (totalLeaves !== undefined)
            updateData.totalLeaves = Number(totalLeaves);
        if (leaveBalance !== undefined)
            updateData.leaveBalance = Number(leaveBalance);
        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: updateData,
        });
        res.json({ message: 'User updated', user });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const user = await prisma.user.findUnique({
            where: { id: Number(id) }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        res.json(user);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Disable / Enable / Left User Management ────────────────────────────────────
router.post('/user/:id/disable', async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    console.log(`[DISABLE USER API] Requested to disable user ID: ${id}, reason: "${reason}"`);
    try {
        if (!reason || reason.trim() === '') {
            console.log(`[DISABLE USER API] Failed: reason is missing or empty`);
            return res.status(400).json({ error: 'Reason is required to temporarily disable account.' });
        }
        const disabledById = req.user.id;
        console.log(`[DISABLE USER API] Performed by Admin ID: ${disabledById}`);
        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data: {
                isDisabled: true,
                disableReason: reason.trim()
            }
        });
        console.log(`[DISABLE USER API] Updated user in DB:`, updatedUser.fullName);
        const log = await prisma.disableLog.create({
            data: {
                userId: Number(id),
                reason: reason.trim(),
                disabledById
            }
        });
        console.log(`[DISABLE USER API] Created disable log record:`, log.id);
        res.json({ message: 'User temporarily disabled successfully.', log });
    }
    catch (error) {
        console.error(`[DISABLE USER API] ERROR:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/user/:id/enable', async (req, res) => {
    const { id } = req.params;
    console.log(`[ENABLE USER API] Requested to enable user ID: ${id}`);
    try {
        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data: {
                isDisabled: false,
                disableReason: null
            }
        });
        console.log(`[ENABLE USER API] Reactivated user:`, updatedUser.fullName);
        const updateLogsResult = await prisma.disableLog.updateMany({
            where: {
                userId: Number(id),
                enabledAt: null
            },
            data: {
                enabledAt: new Date()
            }
        });
        console.log(`[ENABLE USER API] Marked logs as completed:`, updateLogsResult.count);
        res.json({ message: 'User account reactivated successfully.' });
    }
    catch (error) {
        console.error(`[ENABLE USER API] ERROR:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/user/:id/mark-left', async (req, res) => {
    const { id } = req.params;
    const { hasLeft } = req.body;
    console.log(`[MARK LEFT API] Requested to toggle hasLeft to ${hasLeft} for user ID: ${id}`);
    try {
        if (hasLeft === undefined) {
            console.log(`[MARK LEFT API] Failed: hasLeft parameter is missing`);
            return res.status(400).json({ error: 'hasLeft boolean parameter is required.' });
        }
        const updatedUser = await prisma.user.update({
            where: { id: Number(id) },
            data: {
                hasLeft: !!hasLeft
            }
        });
        console.log(`[MARK LEFT API] Successfully updated user ${updatedUser.fullName} hasLeft to ${!!hasLeft}`);
        res.json({ message: hasLeft ? 'Employee marked as left institute.' : 'Employee reactivated successfully.' });
    }
    catch (error) {
        console.error(`[MARK LEFT API] ERROR:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/user/:id/disable-logs', async (req, res) => {
    const { id } = req.params;
    console.log(`[DISABLE LOGS API] Requested logs for user ID: ${id}`);
    try {
        const logs = await prisma.disableLog.findMany({
            where: { userId: Number(id) },
            include: {
                disabledBy: {
                    select: {
                        fullName: true
                    }
                }
            },
            orderBy: { disabledAt: 'desc' }
        });
        console.log(`[DISABLE LOGS API] Returning ${logs.length} log records`);
        res.json(logs);
    }
    catch (error) {
        console.error(`[DISABLE LOGS API] ERROR:`, error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Update Time Slots (replace all for user) ──────────────────────────────────
router.put('/slots/:userId', async (req, res) => {
    try {
        const userId = Number(req.params.userId);
        const slots = req.body.slots;
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Reset Password (resets to mobile number) ──────────────────────────────────
router.post('/reset-password/:id', async (req, res) => {
    try {
        const { newPassword } = req.body;
        const user = await prisma.user.findUnique({ where: { id: Number(req.params.id) } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const passwordToSet = newPassword || user.identifier;
        const hashed = await bcryptjs_1.default.hash(passwordToSet, 10);
        await prisma.user.update({ where: { id: Number(req.params.id) }, data: { password: hashed } });
        res.json({ message: newPassword ? 'Password updated successfully' : `Password has been reset to their mobile number: ${user.identifier}` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Direct Leave (Admin to Trainee) ──────────────────────────────────────────
router.post('/leaves/direct', async (req, res) => {
    try {
        const { traineeId, startDate, endDate, reason, appliedDate, remarksAlternative, remarksOfficeUse } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid dates' });
        }
        const user = await prisma.user.findUnique({ where: { id: Number(traineeId) }, include: { slots: true } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        // Dynamically calculate working days in range based on assigned slot configuration
        let days = 0;
        const scheduledDays = new Set(user.slots.map(s => s.dayOfWeek.toUpperCase()));
        const dMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const curDay = dMap[d.getDay()];
            if (scheduledDays.has(curDay)) {
                days += 1;
            }
        }
        // Fallback to safety ensure at least 0
        days = Math.max(0, days);
        await prisma.$transaction([
            prisma.leaveRequest.create({
                data: {
                    userId: Number(traineeId),
                    startDate: start,
                    endDate: end,
                    reason: reason || 'Direct leave by admin',
                    status: 'APPROVED',
                    adminReason: 'Direct assignment',
                    appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
                    remarksAlternative: remarksAlternative || null,
                    remarksOfficeUse: remarksOfficeUse || null
                }
            }),
            prisma.user.update({
                where: { id: Number(traineeId) },
                data: { leaveBalance: { decrement: days } }
            })
        ]);
        // Async broadcast to sister node instantaneously
        broadcastLeaveToSister({
            identifier: user.identifier,
            startDate: start,
            endDate: end,
            reason: reason || 'Direct leave by admin',
            adminReason: 'Direct assignment',
            appliedDate: appliedDate ? new Date(appliedDate) : new Date(),
            remarksAlternative: remarksAlternative || null,
            remarksOfficeUse: remarksOfficeUse || null
        }).catch(() => { });
        res.json({ message: 'Leave assigned successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Daily Attendance Report ───────────────────────────────────────────────────
router.get('/attendance/daily', async (req, res) => {
    try {
        const { date, statusFilter } = req.query; // statusFilter: 'ALL', 'PRESENT', 'ABSENT'
        if (!date)
            return res.status(400).json({ error: 'Date is required' });
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const endOfTarget = new Date(targetDate);
        endOfTarget.setHours(23, 59, 59, 999);
        const supervisorFilter = req.user?.role === 'SUPERVISOR' ? { supervisors: { some: { id: req.user.id } } } : {};
        const trainees = await prisma.user.findMany({
            where: {
                role: 'TRAINEE',
                hasLeft: false,
                ...supervisorFilter
            },
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
                    { startDate: { lte: endOfTarget } },
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
            if (status === 'ABSENT' && !hasSlot) {
                status = '--';
            }
            if (!att && leave) {
                status = 'LEAVE';
            }
            let inTime = att?.inTime ? new Date(att.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
            let outTime = att?.outTime ? (() => {
                const d = new Date(att.outTime);
                if (d.getHours() === 0 && d.getMinutes() === 0)
                    return '--';
                return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            })() : '--';
            if (!att) {
                if (holiday) {
                    status = 'HOLIDAY';
                    inTime = 'HOLIDAY';
                    outTime = holiday.name;
                }
                else if (leave) {
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
                    if (d.getHours() === 0 && d.getMinutes() === 0)
                        return '--';
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })() : '--',
                inTime2: att?.inTime2 ? new Date(att.inTime2).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime2: att?.outTime2 ? (() => {
                    const d = new Date(att.outTime2);
                    if (d.getHours() === 0 && d.getMinutes() === 0)
                        return '--';
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })() : '--',
                inTime3: att?.inTime3 ? new Date(att.inTime3).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime3: att?.outTime3 ? (() => {
                    const d = new Date(att.outTime3);
                    if (d.getHours() === 0 && d.getMinutes() === 0)
                        return '--';
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })() : '--',
                inTime4: att?.inTime4 ? new Date(att.inTime4).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime4: att?.outTime4 ? (() => {
                    const d = new Date(att.outTime4);
                    if (d.getHours() === 0 && d.getMinutes() === 0)
                        return '--';
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })() : '--',
                inTime5: att?.inTime5 ? new Date(att.inTime5).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime5: att?.outTime5 ? (() => {
                    const d = new Date(att.outTime5);
                    if (d.getHours() === 0 && d.getMinutes() === 0)
                        return '--';
                    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                })() : '--',
            };
        });
        let filtered = result;
        if (statusFilter === 'PRESENT')
            filtered = result.filter(r => r.status === 'IN' || r.status === 'OUT');
        if (statusFilter === 'ABSENT')
            filtered = result.filter(r => r.status === 'ABSENT');
        res.json(filtered);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Removed generateTraineeWorksheet as it's now imported from utils/excel.ts
// ── Download Monthly Excel Report ─────────────────────────────────────────────
router.get('/reports/monthly', async (req, res) => {
    try {
        const { month } = req.query; // e.g., "2026-04"
        if (!month || typeof month !== 'string')
            return res.status(400).json({ error: 'Month is required' });
        const [year, mon] = month.split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
        const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
        const daysInMonth = new Date(year, mon, 0).getDate();
        const trainees = await prisma.user.findMany({
            where: { role: 'TRAINEE', hasLeft: false },
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
            }
            else {
                ws = workbook.addWorksheet(sheetName);
            }
            const traineeAtts = attendances.filter(a => a.userId === trainee.id);
            const traineeLeaves = allLeaves.filter(l => l.userId === trainee.id);
            (0, excel_1.generateTraineeWorksheet)(ws, trainee, traineeAtts, year, mon, daysInMonth, holidays, traineeLeaves);
        }
        if (trainees.length === 0) {
            workbook.addWorksheet('No Data');
        }
        const monthLabel = month ? month.replace('-', '_') : 'All';
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Attendance_${monthLabel}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Download Individual Excel Report ──────────────────────────────────────────
router.get('/reports/individual/:userId', async (req, res) => {
    try {
        const userId = parseInt(req.params.userId);
        const { month } = req.query;
        if (!month || typeof month !== 'string')
            return res.status(400).json({ error: 'Month is required' });
        const user = await prisma.user.findUnique({ where: { id: userId }, include: { slots: true } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const [year, mon] = month.split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
        const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
        const daysInMonth = new Date(year, mon, 0).getDate();
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
        let finalAttendances = attendances;
        let finalHolidays = holidays;
        let finalLeaves = leaves;
        // ── Fetch Sister Data & Cleverly Merge In Real Time
        const sister = await fetchSisterReportData(user.identifier, mon, year);
        if (sister) {
            // Convert serialized JSON strings back into native JS Date objects expected by Excel utility
            const remoteAtt = (sister.attendances || []).map((a) => {
                const res = { ...a, date: new Date(a.date) };
                if (a.inTime)
                    res.inTime = new Date(a.inTime);
                if (a.outTime)
                    res.outTime = new Date(a.outTime);
                for (let i = 1; i <= 5; i++) {
                    if (a[`inTime${i}`])
                        res[`inTime${i}`] = new Date(a[`inTime${i}`]);
                    if (a[`outTime${i}`])
                        res[`outTime${i}`] = new Date(a[`outTime${i}`]);
                }
                return res;
            });
            const remoteHolidays = (sister.holidays || []).map((h) => ({ ...h, date: new Date(h.date) }));
            const remoteLeaves = (sister.leaves || []).map((l) => ({ ...l, startDate: new Date(l.startDate), endDate: new Date(l.endDate) }));
            finalAttendances = mergeAttendances(attendances, remoteAtt);
            finalHolidays = [...holidays, ...remoteHolidays];
            finalLeaves = [...leaves, ...remoteLeaves];
            // ── Explicitly merge remote slots so the report utility has all schedule definitions!
            const remoteSlots = sister.slots || [];
            remoteSlots.forEach((rs) => {
                const exists = user.slots.find(s => s.dayOfWeek === rs.dayOfWeek && s.slotNo === rs.slotNo);
                if (!exists) {
                    // Temporarily add to local user copy for worksheet generation
                    user.slots.push(rs);
                }
            });
        }
        (0, excel_1.generateTraineeWorksheet)(ws, user, finalAttendances, year, mon, daysInMonth, finalHolidays, finalLeaves);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Report_${user.fullName}_${month}.xlsx`);
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Change Own Password ───────────────────────────────────────────────────────
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const userId = req.user.id;
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const isValid = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isValid)
            return res.status(401).json({ error: 'Invalid current password' });
        const hashed = await bcryptjs_1.default.hash(newPassword, 10);
        await prisma.user.update({ where: { id: userId }, data: { password: hashed } });
        res.json({ message: 'Password changed successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Delete User ───────────────────────────────────────────────────────────────
router.delete('/user/:id', async (req, res) => {
    try {
        const { id } = req.params;
        // Delete related records first due to constraints
        await prisma.slot.deleteMany({ where: { userId: Number(id) } });
        await prisma.attendance.deleteMany({ where: { userId: Number(id) } });
        await prisma.leaveRequest.deleteMany({ where: { userId: Number(id) } });
        await prisma.user.delete({ where: { id: Number(id) } });
        res.json({ message: 'User deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Leave Management ─────────────────────────────────────────────────────────
router.put('/leaves/:userId', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/leaves/requests', async (_req, res) => {
    try {
        const requests = await prisma.leaveRequest.findMany({
            include: { user: { select: { fullName: true, identifier: true, department: true, leaveBalance: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(requests);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/leaves/process', async (req, res) => {
    try {
        const { requestId, status, newEndDate, adminReason } = req.body; // status: APPROVED or REJECTED
        const request = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: { user: true }
        });
        if (!request)
            return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'PENDING')
            return res.status(400).json({ error: 'Request already processed' });
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
            // Calculate working days based on schedule config dynamically
            let days = 0;
            const userWithSlots = await prisma.user.findUnique({ where: { id: request.userId }, include: { slots: true } });
            const scheduledDays = new Set(userWithSlots?.slots.map(s => s.dayOfWeek.toUpperCase()));
            const dMap = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            for (let d = new Date(request.startDate); d <= finalEndDate; d.setDate(d.getDate() + 1)) {
                const curDay = dMap[d.getDay()];
                if (scheduledDays.has(curDay)) {
                    days += 1;
                }
            }
            days = Math.max(0, days);
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
            // Cascade approval state to remote institutes instantly
            broadcastLeaveToSister({
                identifier: request.user.identifier,
                startDate: request.startDate,
                endDate: finalEndDate,
                reason: request.reason,
                adminReason: adminReason || 'Approved on primary',
                appliedDate: request.appliedDate,
                remarksAlternative: request.remarksAlternative || null,
                remarksOfficeUse: request.remarksOfficeUse || null
            }).catch(() => { });
        }
        else {
            await prisma.leaveRequest.update({
                where: { id: requestId },
                data: { status: 'REJECTED', adminReason }
            });
        }
        res.json({ message: `Leave ${status.toLowerCase()} successfully` });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/leaves/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const request = await prisma.leaveRequest.findUnique({
            where: { id: Number(id) },
            include: { user: true }
        });
        if (!request)
            return res.status(404).json({ error: 'Request not found' });
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
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Reset Device Locks ───────────────────────────────────────────────────────
// ── Force Logout (Punch Out + Optional Reset) ─────────────────────────────
router.post('/force-logout/:id', async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/attendance-manual/:traineeId', async (req, res) => {
    try {
        const { traineeId } = req.params;
        const { date } = req.query;
        if (!date || typeof date !== 'string') {
            return res.status(400).json({ error: 'Date is required' });
        }
        const targetDate = new Date(date);
        targetDate.setHours(0, 0, 0, 0);
        const attendance = await prisma.attendance.findUnique({
            where: {
                userId_date: {
                    userId: Number(traineeId),
                    date: targetDate
                }
            }
        });
        res.json(attendance || null);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/attendance-manual/:traineeId', async (req, res) => {
    try {
        const { traineeId } = req.params;
        const { inTime, outTime, status, date, slotNo, clearPunchOut, info } = req.body; // inTime/outTime format "HH:mm"
        // Use provided date or fallback to today
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const updateData = {};
        if (status)
            updateData.status = status;
        if (clearPunchOut) {
            if (slotNo && [1, 2, 3, 4, 5].includes(Number(slotNo))) {
                updateData[`outTime${slotNo}`] = null;
                updateData.outTime = null;
            }
            else {
                updateData.outTime = null;
                updateData.outTime1 = null;
                updateData.outTime2 = null;
                updateData.outTime3 = null;
                updateData.outTime4 = null;
                updateData.outTime5 = null;
            }
            updateData.status = 'IN';
        }
        const setTime = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            const d = new Date(targetDate);
            d.setHours(h, m, 0, 0);
            return d;
        };
        if (!clearPunchOut) {
            if (slotNo && [1, 2, 3, 4, 5].includes(Number(slotNo))) {
                const sNum = Number(slotNo);
                if (inTime === '') {
                    updateData[`inTime${sNum}`] = null;
                }
                else if (inTime && inTime !== '--') {
                    updateData[`inTime${sNum}`] = setTime(inTime);
                }
                if (outTime === '') {
                    updateData[`outTime${sNum}`] = null;
                }
                else if (outTime && outTime !== '--') {
                    updateData[`outTime${sNum}`] = setTime(outTime);
                }
                if (info !== undefined) {
                    updateData[`info${sNum}`] = info || null;
                }
                const existing = await prisma.attendance.findUnique({
                    where: { userId_date: { userId: Number(traineeId), date: targetDate } }
                });
                // Collate all punch timings across ALL slots (1-5) to compute proper new global mins/maxes!
                const allIns = [];
                const allOuts = [];
                let hasActivePunchIn = false;
                for (let i = 1; i <= 5; i++) {
                    let finalI = existing?.[`inTime${i}`] || null;
                    let finalO = existing?.[`outTime${i}`] || null;
                    if (i === sNum) {
                        if (inTime !== undefined)
                            finalI = inTime === '' ? null : setTime(inTime);
                        if (outTime !== undefined)
                            finalO = outTime === '' ? null : setTime(outTime);
                    }
                    allIns.push(finalI);
                    allOuts.push(finalO);
                    if (finalI && !finalO) {
                        hasActivePunchIn = true;
                    }
                }
                const validIns = allIns.filter(Boolean);
                const validOuts = allOuts.filter(Boolean);
                updateData.inTime = validIns.length > 0 ? new Date(Math.min(...validIns.map(d => d.getTime()))) : null;
                if (hasActivePunchIn) {
                    updateData.outTime = null;
                    updateData.status = 'IN';
                }
                else {
                    updateData.outTime = validOuts.length > 0 ? new Date(Math.max(...validOuts.map(d => d.getTime()))) : null;
                    if (!updateData.inTime) {
                        updateData.status = 'ABSENT';
                    }
                    else {
                        updateData.status = 'OUT';
                    }
                }
            }
            else {
                if (inTime === '') {
                    updateData.inTime = null;
                    updateData.inTime1 = null;
                    updateData.inTime2 = null;
                    updateData.inTime3 = null;
                    updateData.inTime4 = null;
                    updateData.inTime5 = null;
                }
                else if (inTime && inTime !== '--') {
                    updateData.inTime = setTime(inTime);
                }
                if (outTime === '') {
                    updateData.outTime = null;
                    updateData.outTime1 = null;
                    updateData.outTime2 = null;
                    updateData.outTime3 = null;
                    updateData.outTime4 = null;
                    updateData.outTime5 = null;
                }
                else if (outTime && outTime !== '--') {
                    updateData.outTime = setTime(outTime);
                }
                const finalIn = inTime !== undefined ? (inTime === '' ? null : setTime(inTime)) : undefined;
                const finalOut = outTime !== undefined ? (outTime === '' ? null : setTime(outTime)) : undefined;
                if (finalIn === null) {
                    updateData.status = 'ABSENT';
                }
                else if (finalIn) {
                    if (finalOut === null) {
                        updateData.status = 'IN';
                    }
                    else if (finalOut) {
                        updateData.status = 'OUT';
                    }
                    else {
                        updateData.status = 'IN';
                    }
                }
                if (info !== undefined) {
                    updateData.info = info || null;
                }
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
                if (sMod === 'PM' && sh < 12)
                    sh += 12;
                if (sMod === 'AM' && sh === 12)
                    sh = 0;
                const [h, m] = inTime.split(':').map(Number);
                const inMinutes = h * 60 + m;
                const slotStartMinutes = sh * 60 + sm;
                if (inMinutes > slotStartMinutes) {
                    updateData.isLate = true;
                }
                else {
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
                status: updateData.status || status || (clearPunchOut ? 'IN' : 'OUT')
            }
        });
        res.json({ message: 'Attendance updated manually' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Holidays Management ──────────────────────────────────────────────────────
router.get('/holidays', async (req, res) => {
    try {
        const holidays = await prisma.holiday.findMany({
            orderBy: { date: 'asc' }
        });
        res.json(holidays);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/holidays', async (req, res) => {
    try {
        const { date, name } = req.body;
        if (!date || !name)
            return res.status(400).json({ error: 'Date and Name are required' });
        const holidayDate = new Date(date);
        holidayDate.setHours(0, 0, 0, 0);
        const holiday = await prisma.holiday.create({
            data: { date: holidayDate, name }
        });
        res.json(holiday);
    }
    catch (error) {
        if (error.code === 'P2002')
            return res.status(400).json({ error: 'Holiday already exists for this date' });
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/holidays/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.holiday.delete({ where: { id: Number(id) } });
        res.json({ message: 'Holiday deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Institute Settings (Quota) ────────────────────────────────────────────────
router.get('/settings', async (req, res) => {
    try {
        const settings = await prisma.instituteSettings.findUnique({ where: { id: 1 } });
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/settings', async (req, res) => {
    try {
        const { totalHolidaysQuota, lat, lng, radius, lat2, lng2, radius2, lateRate, lateDeductionType, lateIntervalValue, earlyRate, earlyDeductionType, earlyIntervalValue, absentRate, extraClassRate, otherCenterClassRate, collegeVisitRate, paidLeavesLimit, workingHours, allowPayslipsView } = req.body;
        // Get existing settings to preserve values
        const existing = await prisma.instituteSettings.findUnique({ where: { id: 1 } });
        const settings = await prisma.instituteSettings.upsert({
            where: { id: 1 },
            update: {
                totalHolidaysQuota: totalHolidaysQuota !== undefined ? totalHolidaysQuota : existing?.totalHolidaysQuota,
                lat: lat !== undefined ? lat : existing?.lat,
                lng: lng !== undefined ? lng : existing?.lng,
                radius: radius !== undefined ? radius : existing?.radius,
                lat2: lat2 !== undefined ? lat2 : existing?.lat2,
                lng2: lng2 !== undefined ? lng2 : existing?.lng2,
                radius2: radius2 !== undefined ? radius2 : existing?.radius2,
                lateRate: lateRate !== undefined ? lateRate : existing?.lateRate,
                lateDeductionType: lateDeductionType !== undefined ? lateDeductionType : existing?.lateDeductionType,
                lateIntervalValue: lateIntervalValue !== undefined ? Number(lateIntervalValue) : existing?.lateIntervalValue,
                earlyRate: earlyRate !== undefined ? earlyRate : existing?.earlyRate,
                earlyDeductionType: earlyDeductionType !== undefined ? earlyDeductionType : existing?.earlyDeductionType,
                earlyIntervalValue: earlyIntervalValue !== undefined ? Number(earlyIntervalValue) : existing?.earlyIntervalValue,
                absentRate: absentRate !== undefined ? absentRate : existing?.absentRate,
                paidLeavesLimit: paidLeavesLimit !== undefined ? Number(paidLeavesLimit) : existing?.paidLeavesLimit,
                extraClassRate: extraClassRate !== undefined ? Number(extraClassRate) : existing?.extraClassRate,
                otherCenterClassRate: otherCenterClassRate !== undefined ? Number(otherCenterClassRate) : existing?.otherCenterClassRate,
                collegeVisitRate: collegeVisitRate !== undefined ? Number(collegeVisitRate) : existing?.collegeVisitRate,
                workingHours: workingHours !== undefined ? Number(workingHours) : existing?.workingHours,
                allowPayslipsView: allowPayslipsView !== undefined ? Boolean(allowPayslipsView) : existing?.allowPayslipsView
            },
            create: {
                id: 1,
                totalHolidaysQuota: totalHolidaysQuota || 0,
                lat: lat || 12.9716,
                lng: lng || 77.5946,
                radius: radius || 500,
                lat2: lat2 || 12.9716,
                lng2: lng2 || 77.5946,
                radius2: radius2 || 500,
                lateRate: lateRate !== undefined ? lateRate : 30.0,
                lateDeductionType: lateDeductionType || "instance",
                lateIntervalValue: lateIntervalValue !== undefined ? Number(lateIntervalValue) : 15,
                earlyRate: earlyRate !== undefined ? earlyRate : 30.0,
                earlyDeductionType: earlyDeductionType || "instance",
                earlyIntervalValue: earlyIntervalValue !== undefined ? Number(earlyIntervalValue) : 15,
                absentRate: absentRate !== undefined ? absentRate : 0.0,
                paidLeavesLimit: paidLeavesLimit !== undefined ? Number(paidLeavesLimit) : 0.0,
                extraClassRate: extraClassRate !== undefined ? Number(extraClassRate) : 0.0,
                otherCenterClassRate: otherCenterClassRate !== undefined ? Number(otherCenterClassRate) : 0.0,
                collegeVisitRate: collegeVisitRate !== undefined ? Number(collegeVisitRate) : 0.0,
                workingHours: workingHours !== undefined ? Number(workingHours) : 10.0,
                allowPayslipsView: allowPayslipsView !== undefined ? Boolean(allowPayslipsView) : true
            }
        });
        res.json(settings);
    }
    catch (error) {
        console.error('Settings update error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Notices Management ────────────────────────────────────────────────────────
router.get('/notices', async (req, res) => {
    try {
        const notices = await prisma.notice.findMany({
            include: { user: { select: { fullName: true, identifier: true } } },
            orderBy: { createdAt: 'desc' }
        });
        res.json(notices);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/notices', async (req, res) => {
    try {
        const { message, fromDate, toDate, userId, targetGroup } = req.body;
        if (!message || !fromDate || !toDate) {
            return res.status(400).json({ error: 'Message, fromDate, and toDate are required' });
        }
        const notice = await prisma.notice.create({
            data: {
                message,
                fromDate: new Date(fromDate),
                toDate: new Date(toDate),
                userId: userId ? Number(userId) : null,
                targetGroup: targetGroup || 'ALL'
            },
            include: { user: { select: { fullName: true, identifier: true } } }
        });
        res.json(notice);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/notices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.notice.delete({ where: { id: Number(id) } });
        res.json({ message: 'Notice deleted' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Supervisor Account Provisioning Endpoints (Locked strictly to super ADMIN) ─
router.post('/supervisors', async (req, res) => {
    try {
        // Strict secondary assurance block: only fully authenticated Super Admins can build Supervisor identities!
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Unauthorised: Only a Super Admin can provision new Supervisor privileges.' });
        }
        const { fullName, mobile, password, email, permissions, traineeIds } = req.body;
        if (!fullName || !mobile || !password) {
            return res.status(400).json({ error: 'Full Name, Mobile Number, and Password are required placeholders.' });
        }
        // Check for pre-existing collision
        const existing = await prisma.user.findFirst({
            where: {
                OR: [
                    { identifier: mobile },
                    email ? { email } : { id: -1 }
                ]
            }
        });
        if (existing) {
            return res.status(400).json({ error: 'Account Conflict: A user already exists bearing that exact identifier or email.' });
        }
        const saltRounds = 10;
        const hashedPassword = await bcryptjs_1.default.hash(password, saltRounds);
        // If provided as an array, join to string. Default is fallback.
        const permsStr = Array.isArray(permissions)
            ? permissions.join(',')
            : (typeof permissions === 'string' ? permissions : "RESET_PASSWORD,DIRECT_LEAVE,DOWNLOAD_REPORT");
        const supervisorUser = await prisma.user.create({
            data: {
                role: 'SUPERVISOR',
                fullName,
                identifier: mobile,
                email: email || null,
                password: hashedPassword,
                plainPassword: password,
                isApproved: true, // Supervisor accounts bypass manual onboarding approval pipelines!
                permissions: permsStr
            }
        });
        // Handle initial trainees assignment
        if (Array.isArray(traineeIds) && traineeIds.length > 0) {
            await prisma.user.update({
                where: { id: supervisorUser.id },
                data: {
                    trainees: {
                        connect: traineeIds.map(id => ({ id: Number(id) }))
                    }
                }
            });
        }
        res.json({
            success: true,
            message: 'Supervisor provisions established successfully.',
            user: {
                id: supervisorUser.id,
                fullName: supervisorUser.fullName,
                identifier: supervisorUser.identifier
            }
        });
    }
    catch (err) {
        console.error('[Supervisor-Creation-Error]', err);
        res.status(500).json({ error: 'Internal dynamic system error establishing supervisor context.' });
    }
});
router.get('/supervisors', async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin visibility permissions required.' });
        }
        const listing = await prisma.user.findMany({
            where: { role: 'SUPERVISOR' },
            select: {
                id: true,
                fullName: true,
                identifier: true,
                email: true,
                plainPassword: true,
                createdAt: true,
                permissions: true,
                trainees: {
                    where: { hasLeft: false },
                    select: { id: true, fullName: true, identifier: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(listing);
    }
    catch (err) {
        res.status(500).json({ error: 'Internal listing fetcher fault.' });
    }
});
router.put('/supervisors/:id', async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Unauthorized: Admin privileges required.' });
        }
        const { id } = req.params;
        const { fullName, mobile, password, email, permissions, traineeIds } = req.body;
        const existing = await prisma.user.findUnique({ where: { id: Number(id) } });
        if (!existing || existing.role !== 'SUPERVISOR') {
            return res.status(404).json({ error: 'Supervisor record not found.' });
        }
        const updateData = {};
        if (fullName)
            updateData.fullName = fullName;
        if (mobile) {
            const collision = await prisma.user.findFirst({
                where: { identifier: mobile, NOT: { id: Number(id) } }
            });
            if (collision)
                return res.status(400).json({ error: 'Mobile ID already taken by another account.' });
            updateData.identifier = mobile;
        }
        if (email !== undefined)
            updateData.email = email || null;
        if (permissions !== undefined) {
            updateData.permissions = Array.isArray(permissions)
                ? permissions.join(',')
                : (typeof permissions === 'string' ? permissions : "RESET_PASSWORD,DIRECT_LEAVE,DOWNLOAD_REPORT");
        }
        if (password) {
            updateData.password = await bcryptjs_1.default.hash(password, 10);
            updateData.plainPassword = password;
        }
        if (traineeIds !== undefined) {
            updateData.trainees = {
                set: Array.isArray(traineeIds) ? traineeIds.map(id => ({ id: Number(id) })) : []
            };
        }
        const updated = await prisma.user.update({
            where: { id: Number(id) },
            data: updateData,
            select: { id: true, fullName: true, identifier: true, email: true, plainPassword: true, permissions: true }
        });
        res.json({ success: true, user: updated, message: 'Supervisor profile and permissions updated successfully.' });
    }
    catch (err) {
        console.error('[Update-Supervisor-Error]', err);
        res.status(500).json({ error: 'Failed to process supervisor update.' });
    }
});
router.delete('/supervisors/:id', async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Administrative destructive action limits reached.' });
        }
        const { id } = req.params;
        await prisma.user.delete({ where: { id: Number(id) } });
        res.json({ success: true, message: 'Supervisor authority credentials revoked and erased.' });
    }
    catch (err) {
        res.status(500).json({ error: 'Erase execution failure.' });
    }
});
router.put('/notices/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { message, fromDate, toDate, userId } = req.body;
        if (!message || !fromDate || !toDate) {
            return res.status(400).json({ error: 'Message, fromDate, and toDate are required' });
        }
        const notice = await prisma.notice.update({
            where: { id: Number(id) },
            data: {
                message,
                fromDate: new Date(fromDate),
                toDate: new Date(toDate),
                userId: userId ? Number(userId) : null
            },
            include: { user: { select: { fullName: true, identifier: true } } }
        });
        res.json(notice);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/user/:id/grant-edit', async (req, res) => {
    try {
        const { id } = req.params;
        // Set editAccessGrantedUntil to 24 hours from now
        const editAccessGrantedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const user = await prisma.user.update({
            where: { id: Number(id) },
            data: { editAccessGrantedUntil }
        });
        res.json({ message: 'Edit access granted successfully for 24 hours', user });
    }
    catch (error) {
        console.error('Grant edit error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Dropdown options management
router.get('/options', async (req, res) => {
    try {
        const options = await prisma.dropdownOption.findMany({ orderBy: { createdAt: 'desc' } });
        res.json(options);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/options', async (req, res) => {
    try {
        const { type, value } = req.body;
        if (!type || !value)
            return res.status(400).json({ error: 'Type and value are required' });
        const option = await prisma.dropdownOption.create({
            data: { type, value }
        });
        res.json(option);
    }
    catch (error) {
        console.error(error);
        if (error.code === 'P2002')
            return res.status(400).json({ error: 'Option already exists' });
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/options/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.dropdownOption.delete({ where: { id: Number(id) } });
        res.json({ message: 'Option deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/allow-all-edit-24h', async (req, res) => {
    try {
        const editAccessGrantedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await prisma.user.updateMany({
            where: { role: 'TRAINEE', hasLeft: false },
            data: { editAccessGrantedUntil }
        });
        res.json({ message: 'All trainees have been granted edit access for 24 hours', until: editAccessGrantedUntil });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Dynamic Branch Locations ───────────────────────────────────────────────────
router.get('/branches', async (req, res) => {
    try {
        const branches = await prisma.branchLocation.findMany({ orderBy: { name: 'asc' } });
        res.json(branches);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/branches', async (req, res) => {
    try {
        const { name, branchCode, lat, lng, radius } = req.body;
        if (!name || !lat || !lng)
            return res.status(400).json({ error: 'Missing required branch fields' });
        const branch = await prisma.branchLocation.upsert({
            where: { name: name.trim().toUpperCase() },
            update: {
                branchCode: branchCode ? branchCode.trim().toUpperCase() : null,
                lat: Number(lat),
                lng: Number(lng),
                radius: Number(radius || 100)
            },
            create: {
                name: name.trim().toUpperCase(),
                branchCode: branchCode ? branchCode.trim().toUpperCase() : null,
                lat: Number(lat),
                lng: Number(lng),
                radius: Number(radius || 100)
            }
        });
        res.json(branch);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/branches/:id', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.branchLocation.delete({ where: { id: Number(id) } });
        res.json({ message: 'Branch deleted successfully' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Master Kiosk Device Endpoints ─────────────────────────────────────────────
router.post('/branches/:id/kiosk', async (req, res) => {
    try {
        const { id } = req.params;
        const { deviceId } = req.body;
        if (!deviceId)
            return res.status(400).json({ error: 'Device fingerprint ID is required' });
        // 1. Enforce global uniqueness safety check
        const existingAssignment = await prisma.branchLocation.findFirst({
            where: { kioskDeviceId: deviceId }
        });
        if (existingAssignment) {
            if (existingAssignment.id === Number(id)) {
                return res.json({ message: 'This device is already configured as the kiosk for this center.', branch: existingAssignment });
            }
            else {
                return res.status(400).json({
                    error: `Action Blocked: This device is already allocated to the "${existingAssignment.name}" branch.`
                });
            }
        }
        // 2. Success path: update the specific branch's whitelist
        const updatedBranch = await prisma.branchLocation.update({
            where: { id: Number(id) },
            data: { kioskDeviceId: deviceId }
        });
        res.json({ message: 'Device successfully assigned as the center kiosk!', branch: updatedBranch });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/branches/:id/kiosk', async (req, res) => {
    try {
        const { id } = req.params;
        await prisma.branchLocation.update({
            where: { id: Number(id) },
            data: { kioskDeviceId: null }
        });
        res.json({ message: 'Center kiosk device successfully revoked and cleared.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/sync-sister-permanent', async (req, res) => {
    try {
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;
        // Pull all trainees
        const users = await prisma.user.findMany({
            where: { role: 'TRAINEE' },
            select: { id: true, identifier: true }
        });
        let syncCount = 0;
        let recordCount = 0;
        // Iterate and pull from sister node
        for (const u of users) {
            const sisterData = await fetchSisterReportData(u.identifier, currentMonth, currentYear);
            if (!sisterData || !sisterData.attendances)
                continue;
            syncCount++;
            const remoteAtts = sisterData.attendances;
            for (const rem of remoteAtts) {
                // Normalize date to ensure composite index safety
                const rDate = new Date(rem.date);
                rDate.setHours(0, 0, 0, 0);
                // Check for existing local entry
                const localAtt = await prisma.attendance.findUnique({
                    where: { userId_date: { userId: u.id, date: rDate } }
                });
                const inTime = rem.inTime ? new Date(rem.inTime) : null;
                const outTime = rem.outTime ? new Date(rem.outTime) : null;
                const dataToSave = {
                    status: rem.status || 'OUT',
                    isLate: rem.isLate || false,
                };
                if (inTime)
                    dataToSave.inTime = inTime;
                if (outTime)
                    dataToSave.outTime = outTime;
                for (let i = 1; i <= 5; i++) {
                    if (rem[`inTime${i}`])
                        dataToSave[`inTime${i}`] = new Date(rem[`inTime${i}`]);
                    if (rem[`outTime${i}`])
                        dataToSave[`outTime${i}`] = new Date(rem[`outTime${i}`]);
                }
                if (localAtt) {
                    // Intelligent merge: preserve local records, blend with sister records
                    const mergedData = { ...dataToSave };
                    if (localAtt.inTime && inTime) {
                        mergedData.inTime = new Date(localAtt.inTime) < inTime ? localAtt.inTime : inTime;
                    }
                    else {
                        mergedData.inTime = localAtt.inTime || dataToSave.inTime;
                    }
                    if (localAtt.outTime && outTime) {
                        mergedData.outTime = new Date(localAtt.outTime) > outTime ? localAtt.outTime : outTime;
                    }
                    else {
                        mergedData.outTime = localAtt.outTime || dataToSave.outTime;
                    }
                    mergedData.isLate = localAtt.isLate || rem.isLate;
                    for (let i = 1; i <= 5; i++) {
                        mergedData[`inTime${i}`] = localAtt[`inTime${i}`] || dataToSave[`inTime${i}`] || null;
                        mergedData[`outTime${i}`] = localAtt[`outTime${i}`] || dataToSave[`outTime${i}`] || null;
                    }
                    await prisma.attendance.update({
                        where: { id: localAtt.id },
                        data: mergedData
                    });
                }
                else {
                    // Direct fresh insertion
                    await prisma.attendance.create({
                        data: {
                            userId: u.id,
                            date: rDate,
                            ...dataToSave
                        }
                    });
                }
                recordCount++;
            }
        }
        res.json({
            success: true,
            message: `Permanently fused data. Synced ${syncCount} active users and committed ${recordCount} attendance records.`
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message || 'Failed to perform permanent sister synchronization' });
    }
});
// ── Get Left Trainees for Management ──────────────────────────────────────────
router.get('/left-users', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Admin permissions required.' });
        }
        const today = new Date();
        const users = await prisma.user.findMany({
            where: {
                role: 'TRAINEE',
                hasLeft: true
            },
            orderBy: { fullName: 'asc' },
            include: {
                slots: { orderBy: [{ dayOfWeek: 'asc' }, { slotNo: 'asc' }] }
            }
        });
        const result = users.map((user) => ({
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
            status: '--',
            date: today.toLocaleDateString('en-IN'),
            in: '--',
            out: '--',
            inTime1: '--',
            outTime1: '--',
            inTime2: '--',
            outTime2: '--',
            inTime3: '--',
            outTime3: '--',
            isLate: false,
            isApproved: user.isApproved,
            totalLeaves: user.totalLeaves,
            leaveBalance: user.leaveBalance,
            isDisabled: user.isDisabled,
            disableReason: user.disableReason,
            hasLeft: user.hasLeft,
        }));
        res.json(result);
    }
    catch (error) {
        console.error('[LEFT USERS GET] ERROR:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Teacher Memos Management ──────────────────────────────────────────────────
router.get('/memos/recipients', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            if (req.user.role === 'SUPERVISOR') {
                const supervisor = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { permissions: true }
                });
                const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
                if (!perms.includes('MANAGE_MEMOS')) {
                    return res.status(403).json({ error: 'Access Denied: You do not have permission to manage memos.' });
                }
            }
            else {
                return res.status(403).json({ error: 'Unauthorized: Admin or Supervisor privileges required.' });
            }
        }
        const whereCondition = {
            hasLeft: false
        };
        if (req.user.role === 'SUPERVISOR') {
            whereCondition.role = 'TRAINEE';
            whereCondition.supervisors = { some: { id: req.user.id } };
        }
        else {
            whereCondition.role = { in: ['SUPERVISOR', 'TRAINEE'] };
        }
        const list = await prisma.user.findMany({
            where: whereCondition,
            select: {
                id: true,
                fullName: true,
                identifier: true,
                role: true
            },
            orderBy: { fullName: 'asc' }
        });
        res.json(list);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/memos', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            if (req.user.role === 'SUPERVISOR') {
                const supervisor = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { permissions: true }
                });
                const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
                if (!perms.includes('MANAGE_MEMOS')) {
                    return res.status(403).json({ error: 'Access Denied: You do not have permission to manage memos.' });
                }
            }
            else {
                return res.status(403).json({ error: 'Only admins or authorized supervisors can issue memos.' });
            }
        }
        const { recipientId, content } = req.body;
        if (!recipientId || !content || content.trim() === '') {
            return res.status(400).json({ error: 'Recipient and Content are required.' });
        }
        if (req.user.role === 'SUPERVISOR') {
            const trainee = await prisma.user.findFirst({
                where: {
                    id: Number(recipientId),
                    role: 'TRAINEE',
                    supervisors: { some: { id: req.user.id } }
                }
            });
            if (!trainee) {
                return res.status(403).json({ error: 'Access Denied: You can only send memos to trainees assigned under you.' });
            }
        }
        const memo = await prisma.memo.create({
            data: {
                content: content.trim(),
                recipientId: Number(recipientId),
                senderId: req.user.id,
            },
            include: {
                recipient: { select: { fullName: true } }
            }
        });
        res.status(201).json({ message: 'Memo sent successfully', memo });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/memos/sent', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== 'ADMIN') {
            if (req.user.role === 'SUPERVISOR') {
                const supervisor = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { permissions: true }
                });
                const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
                if (!perms.includes('MANAGE_MEMOS')) {
                    return res.status(403).json({ error: 'Access Denied: You do not have permission to manage memos.' });
                }
            }
            else {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }
        const memos = await prisma.memo.findMany({
            where: { senderId: req.user.id },
            include: {
                recipient: { select: { fullName: true, identifier: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(memos);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/memos/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const memoId = Number(id);
        const memo = await prisma.memo.findUnique({
            where: { id: memoId }
        });
        if (!memo) {
            return res.status(404).json({ error: 'Memo not found' });
        }
        if (req.user.role !== 'ADMIN') {
            if (req.user.role === 'SUPERVISOR') {
                const supervisor = await prisma.user.findUnique({
                    where: { id: req.user.id },
                    select: { permissions: true }
                });
                const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
                if (!perms.includes('MANAGE_MEMOS')) {
                    return res.status(403).json({ error: 'Access Denied: You do not have permission to manage memos.' });
                }
                if (memo.senderId !== req.user.id) {
                    return res.status(403).json({ error: 'Access Denied: You can only delete memos that you sent.' });
                }
            }
            else {
                return res.status(403).json({ error: 'Unauthorized' });
            }
        }
        await prisma.memo.delete({
            where: { id: memoId }
        });
        res.json({ message: 'Memo deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/memos/received', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id;
        const role = req.user.role;
        let whereCondition = { recipientId: userId };
        if (role === 'SUPERVISOR') {
            whereCondition = {
                OR: [
                    { recipientId: userId },
                    { recipient: { supervisors: { some: { id: userId } } } }
                ]
            };
        }
        const memos = await prisma.memo.findMany({
            where: whereCondition,
            include: {
                sender: { select: { fullName: true } },
                recipient: { select: { id: true, fullName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(memos);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
function parseCollegeVisit(b) {
    const bookletNo = b.bookletNo || '--';
    let collegeName = b.collegeName || '';
    let subject = b.subject || '';
    const topicsCovered = b.topicsCovered || '--';
    const conveyance = b.conveyance || '--';
    const numberOfHours = b.numberOfHours || '--';
    const fromTime = b.fromTime || '--';
    const toTime = b.toTime || '--';
    if (!collegeName && b.reason && b.reason.startsWith('College Visit:')) {
        if (b.reason.includes('Booklet No:')) {
            const parts = b.reason.split('|').map((p) => p.trim());
            const bookletPart = parts.find((p) => p.startsWith('Booklet No:'));
            const collegePart = parts.find((p) => p.startsWith('College:'));
            const subjectPart = parts.find((p) => p.startsWith('Subject:'));
            return {
                bookletNo: bookletPart ? bookletPart.replace('Booklet No:', '').trim() : '--',
                collegeName: collegePart ? collegePart.replace('College:', '').trim() : '--',
                subject: subjectPart ? subjectPart.replace('Subject:', '').trim() : '--',
                topicsCovered: '--',
                conveyance: '--',
                numberOfHours: '--',
                fromTime: '--',
                toTime: '--'
            };
        }
        else {
            const match = b.reason.match(/College Visit:\s*(.*?)\s*\(Subject:\s*(.*?)\)/);
            if (match) {
                collegeName = match[1];
                subject = match[2];
            }
            else {
                collegeName = b.reason.replace('College Visit:', '').trim();
            }
        }
    }
    return {
        bookletNo,
        collegeName: collegeName || '--',
        subject: subject || '--',
        topicsCovered,
        conveyance,
        numberOfHours,
        fromTime,
        toTime
    };
}
// ── Teacher Break System Reports Endpoints ─────────────────────────────────────
router.get('/reports/breaks', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { date, search, type } = req.query;
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            const requiredPerm = type === 'COLLEGE_VISIT' ? 'MANAGE_COLLEGE_VISITS' : 'MANAGE_BREAKS';
            if (!perms.includes(requiredPerm)) {
                return res.status(403).json({ error: `Access Denied: You do not have clearance to manage ${type === 'COLLEGE_VISIT' ? 'college visits' : 'breaks'}.` });
            }
        }
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const searchStr = search;
        const supervisorFilter = req.user?.role === 'SUPERVISOR' ? { user: { supervisors: { some: { id: req.user.id } } } } : {};
        const breakLogs = await prisma.breakLog.findMany({
            where: {
                date: targetDate,
                status: type === 'COLLEGE_VISIT' ? { in: ['APPROVED', 'PENDING', 'REJECTED'] } : 'APPROVED',
                ...supervisorFilter,
                user: {
                    OR: searchStr ? [
                        { fullName: { contains: searchStr, mode: 'insensitive' } },
                        { identifier: { contains: searchStr, mode: 'insensitive' } }
                    ] : undefined
                }
            },
            include: {
                user: {
                    select: {
                        fullName: true,
                        identifier: true,
                        department: true,
                        supervisors: {
                            select: {
                                fullName: true
                            }
                        }
                    }
                }
            },
            orderBy: { breakOut: 'desc' }
        });
        let filteredLogs = breakLogs;
        if (type === 'COLLEGE_VISIT') {
            filteredLogs = breakLogs.filter(b => b.reason && b.reason.startsWith('College Visit:'));
        }
        else if (type === 'NORMAL') {
            filteredLogs = breakLogs.filter(b => !b.reason || !b.reason.startsWith('College Visit:'));
        }
        const userIds = filteredLogs.map(b => b.userId);
        const attendances = await prisma.attendance.findMany({
            where: {
                date: targetDate,
                userId: { in: userIds }
            }
        });
        const result = filteredLogs.map(b => {
            const att = attendances.find(a => a.userId === b.userId);
            let punchIn = '--';
            let punchOut = '--';
            let punchDuration = '--';
            if (att && att.inTime) {
                punchIn = new Date(att.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            if (att && att.outTime) {
                punchOut = new Date(att.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            }
            if (att && att.inTime && att.outTime) {
                const diffMs = new Date(att.outTime).getTime() - new Date(att.inTime).getTime();
                const mins = Math.round(diffMs / 60000);
                if (mins > 0) {
                    punchDuration = `${mins} mins (${(mins / 60).toFixed(2)} hrs)`;
                }
            }
            const duration = b.breakIn
                ? Math.round((new Date(b.breakIn).getTime() - new Date(b.breakOut).getTime()) / (1000 * 60))
                : null;
            const durationHrs = b.breakIn
                ? Number(((new Date(b.breakIn).getTime() - new Date(b.breakOut).getTime()) / 3600000).toFixed(2))
                : null;
            const parsed = parseCollegeVisit(b);
            return {
                id: b.id,
                userId: b.userId,
                date: b.date.toLocaleDateString('en-IN'),
                name: b.user.fullName,
                identifier: b.user.identifier,
                department: b.user.department || '--',
                supervisor: b.user.supervisors.map((s) => s.fullName).join(', ') || '--',
                breakOut: new Date(b.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                breakIn: b.breakIn
                    ? new Date(b.breakIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    : 'On Break',
                duration: duration !== null ? `${duration} mins (${durationHrs} hrs)` : 'On Break',
                punchIn,
                punchOut,
                punchDuration,
                reason: b.reason || '--',
                status: b.status,
                // Structured fields for college visits
                bookletNo: parsed.bookletNo,
                collegeName: parsed.collegeName,
                subject: parsed.subject,
                topicsCovered: parsed.topicsCovered,
                conveyance: parsed.conveyance,
                numberOfHours: parsed.numberOfHours,
                fromTime: parsed.fromTime,
                toTime: parsed.toTime
            };
        });
        res.json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/reports/breaks/export', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { month, search, type } = req.query; // e.g., "2026-05", with optional search & type
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            const requiredPerm = type === 'COLLEGE_VISIT' ? 'MANAGE_COLLEGE_VISITS' : 'MANAGE_BREAKS';
            if (!perms.includes(requiredPerm)) {
                return res.status(403).json({ error: `Access Denied: You do not have clearance to export ${type === 'COLLEGE_VISIT' ? 'college visits' : 'breaks'}.` });
            }
        }
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'Month is required' });
        }
        const [year, mon] = month.split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
        const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
        const daysInMonth = new Date(year, mon, 0).getDate();
        const searchStr = search;
        const supervisorFilter = req.user?.role === 'SUPERVISOR' ? { user: { supervisors: { some: { id: req.user.id } } } } : {};
        const breakLogs = await prisma.breakLog.findMany({
            where: {
                date: { gte: startOfMonth, lte: endOfMonth },
                status: 'APPROVED',
                ...supervisorFilter,
                user: {
                    OR: searchStr ? [
                        { fullName: { contains: searchStr, mode: 'insensitive' } },
                        { identifier: { contains: searchStr, mode: 'insensitive' } }
                    ] : undefined
                }
            },
            include: {
                user: { select: { id: true, fullName: true, identifier: true, department: true } }
            },
            orderBy: [
                { date: 'asc' },
                { breakOut: 'asc' }
            ]
        });
        let filteredBreakLogs = breakLogs;
        if (type === 'COLLEGE_VISIT') {
            filteredBreakLogs = breakLogs.filter(b => b.reason && b.reason.startsWith('College Visit:'));
        }
        else if (type === 'NORMAL') {
            filteredBreakLogs = breakLogs.filter(b => !b.reason || !b.reason.startsWith('College Visit:'));
        }
        // 1. Identify target teachers/users to build pages (tabs) for
        let targetUsersList = [];
        if (searchStr) {
            const targetUser = await prisma.user.findFirst({
                where: {
                    ...supervisorFilter,
                    OR: [
                        { fullName: { contains: searchStr, mode: 'insensitive' } },
                        { identifier: { contains: searchStr, mode: 'insensitive' } }
                    ]
                },
                select: { id: true, fullName: true, identifier: true, department: true }
            });
            if (targetUser) {
                const hasLogs = filteredBreakLogs.some(b => b.userId === targetUser.id);
                if (hasLogs) {
                    targetUsersList.push(targetUser);
                }
            }
        }
        else {
            const uniqueUsersMap = new Map();
            filteredBreakLogs.forEach(b => {
                if (!uniqueUsersMap.has(b.userId)) {
                    uniqueUsersMap.set(b.userId, b.user);
                }
            });
            targetUsersList = Array.from(uniqueUsersMap.values());
        }
        const targetUserIds = targetUsersList.map(u => u.id);
        const monthlyAttendances = await prisma.attendance.findMany({
            where: {
                date: { gte: startOfMonth, lte: endOfMonth },
                userId: { in: targetUserIds }
            }
        });
        const workbook = new exceljs.Workbook();
        workbook.creator = 'Attendance System';
        if (targetUsersList.length === 0) {
            const ws = workbook.addWorksheet('No Data');
            ws.getCell('A1').value = 'No break logs found for this month.';
        }
        else {
            const usedNames = new Set();
            for (const user of targetUsersList) {
                // Excel sheet names are limited to 31 chars and must be unique
                let sheetName = user.fullName.substring(0, 30);
                let counter = 1;
                while (usedNames.has(sheetName)) {
                    const suffix = `_${counter}`;
                    sheetName = `${user.fullName.substring(0, 30 - suffix.length)}${suffix}`;
                    counter++;
                }
                usedNames.add(sheetName);
                const ws = workbook.addWorksheet(sheetName);
                // Define columns
                if (type === 'COLLEGE_VISIT') {
                    ws.columns = [
                        { key: 'day', width: 15 },
                        { key: 'date', width: 15 },
                        { key: 'bookletNo', width: 15 },
                        { key: 'collegeName', width: 25 },
                        { key: 'subject', width: 25 },
                        { key: 'topicsCovered', width: 30 },
                        { key: 'conveyance', width: 25 },
                        { key: 'fromTime', width: 15 },
                        { key: 'toTime', width: 15 },
                        { key: 'numberOfHours', width: 15 },
                        { key: 'punchIn', width: 20 },
                        { key: 'punchOut', width: 20 },
                        { key: 'punchDuration', width: 15 }
                    ];
                }
                else {
                    ws.columns = [
                        { key: 'day', width: 15 },
                        { key: 'date', width: 15 },
                        { key: 'breakOut', width: 25 },
                        { key: 'breakIn', width: 25 },
                        { key: 'duration', width: 20 },
                        { key: 'reason', width: 35 }
                    ];
                }
                // Title Block (Row 1)
                if (type === 'COLLEGE_VISIT') {
                    ws.mergeCells('A1:M1');
                }
                else {
                    ws.mergeCells('A1:F1');
                }
                const titleCell = ws.getCell('A1');
                let reportTitle = 'BREAK REPORT';
                if (type === 'COLLEGE_VISIT') {
                    reportTitle = 'COLLEGE VISIT REPORT';
                }
                else if (type === 'NORMAL') {
                    reportTitle = 'DAILY OUTING REPORT';
                }
                titleCell.value = `${reportTitle}: ${user.fullName.toUpperCase()} | PHONE: ${user.identifier}`;
                titleCell.font = { bold: true, size: 14, name: 'Calibri' };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                titleCell.border = {
                    top: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    left: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    right: { style: 'thin', color: { argb: 'FFD3D3D3' } },
                    bottom: { style: 'thin', color: { argb: 'FFD3D3D3' } }
                };
                ws.getRow(1).height = 40;
                ws.getRow(2).height = 15;
                ws.getRow(3).height = 25;
                // Header Row (Row 3)
                const headerRow = ws.getRow(3);
                if (type === 'COLLEGE_VISIT') {
                    headerRow.values = [
                        'Day',
                        'Date',
                        'Booklet No',
                        'College Name',
                        'Subject / Purpose',
                        'Topics Covered',
                        'Conveyance Details',
                        'From Time',
                        'To Time',
                        'No of hours',
                        'Punch In Time',
                        'Punch Out Time',
                        'Punch Duration'
                    ];
                }
                else {
                    headerRow.values = ['Day', 'Date', 'Break Out Time', 'Break In Time', 'Duration', 'Reason for Break'];
                }
                headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11, name: 'Calibri' };
                headerRow.eachCell((cell, colNumber) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: '1F4E79' }
                    };
                    cell.alignment = {
                        horizontal: colNumber <= 2 ? 'left' : 'center',
                        vertical: 'middle'
                    };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFFFFF' } },
                        left: { style: 'thin', color: { argb: 'FFFFFF' } },
                        right: { style: 'thin', color: { argb: 'FFFFFF' } },
                        bottom: { style: 'thin', color: { argb: 'FFFFFF' } }
                    };
                });
                // Filter logs for this specific user
                const userBreaks = filteredBreakLogs.filter(b => b.userId === user.id);
                const userAttendances = monthlyAttendances.filter(a => a.userId === user.id);
                const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
                let monthlyTotalMins = 0;
                let monthlyTotalHours = 0;
                // Populate days
                for (let day = 1; day <= daysInMonth; day++) {
                    const d = new Date(year, mon - 1, day, 12, 0, 0);
                    const dayStr = daysOfWeek[d.getDay()];
                    const dateStr = `${day}/${mon}/${year}`;
                    // Format stable local timezone-immune date keys for comparison
                    const localDateKey = `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const dayAtt = userAttendances.find(a => {
                        const aDate = new Date(a.date.getTime() + (5.5 * 60 * 60 * 1000));
                        const aYear = aDate.getUTCFullYear();
                        const aMonth = String(aDate.getUTCMonth() + 1).padStart(2, '0');
                        const aDay = String(aDate.getUTCDate()).padStart(2, '0');
                        return `${aYear}-${aMonth}-${aDay}` === localDateKey;
                    });
                    let punchInVal = '--';
                    let punchOutVal = '--';
                    let punchDurationVal = '--';
                    let dailyPunchMins = 0;
                    if (dayAtt && dayAtt.inTime) {
                        punchInVal = new Date(dayAtt.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                    if (dayAtt && dayAtt.outTime) {
                        punchOutVal = new Date(dayAtt.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    }
                    if (dayAtt && dayAtt.inTime && dayAtt.outTime) {
                        const diffMs = new Date(dayAtt.outTime).getTime() - new Date(dayAtt.inTime).getTime();
                        dailyPunchMins = Math.round(diffMs / 60000);
                        if (dailyPunchMins > 0) {
                            const actualHrs = (dailyPunchMins / 60).toFixed(2);
                            punchDurationVal = `${dailyPunchMins} mins (${actualHrs} hrs)`;
                        }
                    }
                    const dayBreaks = userBreaks.filter(b => {
                        const bDate = new Date(b.date.getTime() + (5.5 * 60 * 60 * 1000));
                        const bYear = bDate.getUTCFullYear();
                        const bMonth = String(bDate.getUTCMonth() + 1).padStart(2, '0');
                        const bDay = String(bDate.getUTCDate()).padStart(2, '0');
                        const bLocalDateKey = `${bYear}-${bMonth}-${bDay}`;
                        return bLocalDateKey === localDateKey;
                    });
                    let bookletNoVal = '--';
                    let collegeNameVal = '--';
                    let subjectVal = '--';
                    let topicsCoveredVal = '--';
                    let conveyanceVal = '--';
                    let fromTimeVal = '--';
                    let toTimeVal = '--';
                    let numberOfHoursVal = '--';
                    let breakOutVal = '--';
                    let breakInVal = '--';
                    let reasonVal = '--';
                    if (dayBreaks.length > 0) {
                        const bookletNoList = [];
                        const collegeNameList = [];
                        const subjectList = [];
                        const topicsCoveredList = [];
                        const conveyanceList = [];
                        const fromTimeList = [];
                        const toTimeList = [];
                        const numberOfHoursList = [];
                        const outTimesList = [];
                        const inTimesList = [];
                        const reasonsList = [];
                        dayBreaks.forEach((b, idx) => {
                            const outStr = new Date(b.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                            const inStr = b.breakIn
                                ? new Date(b.breakIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : 'On Break';
                            if (type === 'COLLEGE_VISIT') {
                                const parsed = parseCollegeVisit(b);
                                const hrs = parseFloat(parsed.numberOfHours);
                                if (!isNaN(hrs)) {
                                    monthlyTotalHours += hrs;
                                }
                                if (dayBreaks.length > 1) {
                                    bookletNoList.push(`Break ${idx + 1}: ${parsed.bookletNo}`);
                                    collegeNameList.push(`Break ${idx + 1}: ${parsed.collegeName}`);
                                    subjectList.push(`Break ${idx + 1}: ${parsed.subject}`);
                                    topicsCoveredList.push(`Break ${idx + 1}: ${parsed.topicsCovered}`);
                                    conveyanceList.push(`Break ${idx + 1}: ${parsed.conveyance}`);
                                    fromTimeList.push(`Break ${idx + 1}: ${parsed.fromTime}`);
                                    toTimeList.push(`Break ${idx + 1}: ${parsed.toTime}`);
                                    numberOfHoursList.push(`Break ${idx + 1}: ${parsed.numberOfHours}`);
                                    outTimesList.push(`Break ${idx + 1}: ${outStr}`);
                                    inTimesList.push(`Break ${idx + 1}: ${inStr}`);
                                }
                                else {
                                    bookletNoList.push(parsed.bookletNo);
                                    collegeNameList.push(parsed.collegeName);
                                    subjectList.push(parsed.subject);
                                    topicsCoveredList.push(parsed.topicsCovered);
                                    conveyanceList.push(parsed.conveyance);
                                    fromTimeList.push(parsed.fromTime);
                                    toTimeList.push(parsed.toTime);
                                    numberOfHoursList.push(parsed.numberOfHours);
                                    outTimesList.push(outStr);
                                    inTimesList.push(inStr);
                                }
                            }
                            else {
                                if (dayBreaks.length > 1) {
                                    outTimesList.push(`Break ${idx + 1}: ${outStr}`);
                                    inTimesList.push(`Break ${idx + 1}: ${inStr}`);
                                    reasonsList.push(`Break ${idx + 1}: ${b.reason || '--'}`);
                                }
                                else {
                                    outTimesList.push(outStr);
                                    inTimesList.push(inStr);
                                    reasonsList.push(b.reason || '--');
                                }
                            }
                        });
                        if (type === 'COLLEGE_VISIT') {
                            bookletNoVal = bookletNoList.join('\n');
                            collegeNameVal = collegeNameList.join('\n');
                            subjectVal = subjectList.join('\n');
                            topicsCoveredVal = topicsCoveredList.join('\n');
                            conveyanceVal = conveyanceList.join('\n');
                            fromTimeVal = fromTimeList.join('\n');
                            toTimeVal = toTimeList.join('\n');
                            numberOfHoursVal = numberOfHoursList.join('\n');
                            breakOutVal = outTimesList.join('\n');
                            breakInVal = inTimesList.join('\n');
                        }
                        else {
                            breakOutVal = outTimesList.join('\n');
                            breakInVal = inTimesList.join('\n');
                            reasonVal = reasonsList.join('\n');
                        }
                    }
                    const rowData = type === 'COLLEGE_VISIT'
                        ? [dayStr, dateStr, bookletNoVal, collegeNameVal, subjectVal, topicsCoveredVal, conveyanceVal, fromTimeVal, toTimeVal, numberOfHoursVal, punchInVal, punchOutVal, punchDurationVal]
                        : [dayStr, dateStr, breakOutVal, breakInVal, '', reasonVal];
                    const row = ws.addRow(rowData);
                    const durationColIndex = type === 'COLLEGE_VISIT' ? 13 : 5;
                    if (type === 'COLLEGE_VISIT') {
                        if (dayBreaks.length > 0) {
                            if (dailyPunchMins > 0) {
                                monthlyTotalMins += dailyPunchMins;
                            }
                            if (dayBreaks.length > 1) {
                                row.getCell(10).value = numberOfHoursVal;
                            }
                            else if (dayBreaks.length === 1) {
                                const parsed = parseCollegeVisit(dayBreaks[0]);
                                const hrs = parseFloat(parsed.numberOfHours);
                                if (!isNaN(hrs)) {
                                    row.getCell(10).value = hrs;
                                    row.getCell(10).numFmt = '0.0" hrs"';
                                }
                                else {
                                    row.getCell(10).value = parsed.numberOfHours;
                                }
                            }
                            else {
                                row.getCell(10).value = '--';
                            }
                        }
                        else {
                            row.getCell(10).value = '--';
                        }
                    }
                    else {
                        if (dayBreaks.length > 0) {
                            let totalMins = 0;
                            let isOnBreak = false;
                            dayBreaks.forEach((b) => {
                                if (b.breakIn) {
                                    const diffMs = new Date(b.breakIn).getTime() - new Date(b.breakOut).getTime();
                                    const mins = Math.round(diffMs / 60000);
                                    if (mins > 0)
                                        totalMins += mins;
                                }
                                else {
                                    isOnBreak = true;
                                }
                            });
                            if (isOnBreak) {
                                row.getCell(durationColIndex).value = 'On Break';
                            }
                            else if (totalMins > 0) {
                                const actualHrs = (totalMins / 60).toFixed(2);
                                row.getCell(durationColIndex).value = `${totalMins} mins (${actualHrs} hrs)`;
                                monthlyTotalMins += totalMins;
                            }
                            else {
                                row.getCell(durationColIndex).value = '--';
                            }
                        }
                        else {
                            row.getCell(durationColIndex).value = '--';
                        }
                    }
                    row.eachCell((cell, colNumber) => {
                        cell.alignment = {
                            wrapText: true,
                            vertical: 'top',
                            horizontal: colNumber <= 2 || (type !== 'COLLEGE_VISIT' && colNumber === 6) || (type === 'COLLEGE_VISIT' && [3, 4, 5, 6, 7].includes(colNumber)) ? 'left' : 'center'
                        };
                        cell.font = { name: 'Calibri', size: 10 };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            left: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            right: { style: 'thin', color: { argb: 'FFE0E0E0' } },
                            bottom: { style: 'thin', color: { argb: 'FFE0E0E0' } }
                        };
                    });
                }
                // Add Spacer Row
                ws.addRow([]);
                // Add Grand Total Row
                const totalRowData = type === 'COLLEGE_VISIT'
                    ? ['', 'TOTAL DURATION & HOURS', '', '', '', '', '', '', '', monthlyTotalHours, '', '', `${monthlyTotalMins} mins (${(monthlyTotalMins / 60).toFixed(2)} hrs)`]
                    : ['', 'TOTAL DURATION', '', '', monthlyTotalMins, ''];
                const totalRow = ws.addRow(totalRowData);
                totalRow.height = 24;
                if (type === 'COLLEGE_VISIT') {
                    ws.mergeCells(`B${totalRow.number}:I${totalRow.number}`);
                }
                else {
                    ws.mergeCells(`B${totalRow.number}:D${totalRow.number}`);
                }
                const totalDurationColIndex = type === 'COLLEGE_VISIT' ? 13 : 5;
                const totalColsCount = type === 'COLLEGE_VISIT' ? 13 : 6;
                totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    if (colNumber >= 1 && colNumber <= totalColsCount) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: '1F4E79' }
                        };
                        cell.font = {
                            bold: true,
                            name: 'Calibri',
                            size: (colNumber === totalDurationColIndex || (type === 'COLLEGE_VISIT' && colNumber === 10)) ? 11 : 10,
                            color: { argb: 'FFFFFFFF' }
                        };
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: (colNumber === totalDurationColIndex || (type === 'COLLEGE_VISIT' && colNumber === 10)) ? 'center' : (colNumber === 2 ? 'left' : 'center')
                        };
                        cell.border = {
                            top: { style: 'medium', color: { argb: 'FF1F4E79' } },
                            left: { style: 'thin', color: { argb: 'FFFFFF' } },
                            right: { style: 'thin', color: { argb: 'FFFFFF' } },
                            bottom: { style: 'medium', color: { argb: 'FF1F4E79' } }
                        };
                    }
                });
                if (type === 'COLLEGE_VISIT') {
                    totalRow.getCell(10).numFmt = '0.0" hrs"';
                }
                else {
                    totalRow.getCell(totalDurationColIndex).numFmt = '0" mins"';
                }
                // Auto-fit column widths (safety margins)
                ws.columns.forEach(col => {
                    let maxLen = 12;
                    col.values?.forEach(val => {
                        if (val) {
                            const lines = val.toString().split('\n');
                            lines.forEach((line) => {
                                if (line.length > maxLen)
                                    maxLen = line.length;
                            });
                        }
                    });
                    col.width = Math.min(Math.max(maxLen + 4, 12), 40);
                });
            }
        }
        let filename = `Break_Report_${month}.xlsx`;
        if (searchStr && targetUsersList.length > 0) {
            const teacherName = targetUsersList[0].fullName.replace(/\s+/g, '_');
            if (type === 'COLLEGE_VISIT') {
                filename = `${teacherName}_College_Visits_${month}.xlsx`;
            }
            else if (type === 'NORMAL') {
                filename = `${teacherName}_Daily_Outings_${month}.xlsx`;
            }
            else {
                filename = `${teacherName}_Breaks_${month}.xlsx`;
            }
        }
        else {
            if (type === 'COLLEGE_VISIT') {
                filename = `College_Visits_Report_${month}.xlsx`;
            }
            else if (type === 'NORMAL') {
                filename = `Daily_Outings_Report_${month}.xlsx`;
            }
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Pending Break Requests Approval pipeline (Sandboxed) ───────────────────────────
router.get('/reports/breaks/pending', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const supervisorFilter = req.user?.role === 'SUPERVISOR' ? { user: { supervisors: { some: { id: req.user.id } } } } : {};
        let allowedTypes = [];
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (perms.includes('MANAGE_BREAKS'))
                allowedTypes.push('NORMAL');
            if (perms.includes('MANAGE_COLLEGE_VISITS'))
                allowedTypes.push('COLLEGE_VISIT');
            if (allowedTypes.length === 0) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage breaks or college visits.' });
            }
        }
        else {
            allowedTypes = ['NORMAL', 'COLLEGE_VISIT'];
        }
        const pendingLogs = await prisma.breakLog.findMany({
            where: {
                status: 'PENDING',
                ...supervisorFilter
            },
            include: {
                user: { select: { fullName: true, identifier: true, department: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        const filteredLogs = pendingLogs.filter(b => {
            const isCollege = b.reason && b.reason.startsWith('College Visit:');
            if (isCollege && allowedTypes.includes('COLLEGE_VISIT'))
                return true;
            if (!isCollege && allowedTypes.includes('NORMAL'))
                return true;
            return false;
        });
        const result = filteredLogs.map(b => ({
            id: b.id,
            date: b.date.toLocaleDateString('en-IN'),
            name: b.user.fullName,
            identifier: b.user.identifier,
            department: b.user.department || '--',
            breakOut: new Date(b.breakOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            reason: b.reason || '--'
        }));
        res.json(result);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/reports/breaks/process', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { breakLogId, status } = req.body;
        if (!breakLogId || !['APPROVED', 'REJECTED'].includes(status)) {
            return res.status(400).json({ error: 'Invalid payload parameters' });
        }
        const breakLog = await prisma.breakLog.findUnique({
            where: { id: Number(breakLogId) },
            include: { user: { include: { supervisors: true } } }
        });
        if (!breakLog) {
            return res.status(404).json({ error: 'Break request not found.' });
        }
        // Strict Supervisor Authorization Sandbox & Clearance Checks
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            const isCollege = breakLog.reason && breakLog.reason.startsWith('College Visit:');
            const requiredPerm = isCollege ? 'MANAGE_COLLEGE_VISITS' : 'MANAGE_BREAKS';
            if (!perms.includes(requiredPerm)) {
                return res.status(403).json({ error: `Access Denied: You do not have clearance to manage ${isCollege ? 'college visits' : 'breaks'}.` });
            }
            const isAssigned = breakLog.user.supervisors.some(s => s.id === req.user.id);
            if (!isAssigned) {
                return res.status(403).json({ error: 'Access Denied: You can only process break requests for trainees assigned to you.' });
            }
        }
        if (breakLog.status !== 'PENDING') {
            return res.status(400).json({ error: 'This break request has already been processed.' });
        }
        const updated = await prisma.breakLog.update({
            where: { id: breakLog.id },
            data: {
                status,
                // If approved, reset breakOut to now so they get their full break starting from the moment of approval
                breakOut: status === 'APPROVED' ? new Date() : breakLog.breakOut
            }
        });
        res.json({
            success: true,
            message: `Break request ${status.toLowerCase()} successfully.`,
            breakLog: updated
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/reports/breaks/direct-out', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { traineeId, collegeName, subject } = req.body;
        if (!traineeId || !collegeName || !subject) {
            return res.status(400).json({ error: 'Required fields missing: traineeId, collegeName, and subject.' });
        }
        const trainee = await prisma.user.findUnique({
            where: { id: Number(traineeId) },
            include: { supervisors: true }
        });
        if (!trainee || trainee.role !== 'TRAINEE') {
            return res.status(404).json({ error: 'Trainee not found.' });
        }
        // Strict Supervisor Sandbox & Clearance Access Checks
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_COLLEGE_VISITS')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage college visits.' });
            }
            const isAssigned = trainee.supervisors.some(s => s.id === req.user.id);
            if (!isAssigned) {
                return res.status(403).json({ error: 'Access Denied: You can only direct breakout trainees assigned under you.' });
            }
        }
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const attendance = await prisma.attendance.findUnique({
            where: { userId_date: { userId: trainee.id, date: today } }
        });
        if (!attendance || attendance.status !== 'IN') {
            return res.status(400).json({ error: 'Trainee must be Punched In to go on break.' });
        }
        const todayBreaks = await prisma.breakLog.findMany({
            where: { userId: trainee.id, date: today }
        });
        const activeBreak = todayBreaks.find(b => b.breakIn === null);
        if (activeBreak) {
            return res.status(400).json({ error: 'Trainee is already on an active break.' });
        }
        const approvedBreaks = todayBreaks.filter(b => b.status === 'APPROVED');
        if (approvedBreaks.length >= 4) {
            return res.status(400).json({ error: 'Maximum 4 breaks allowed in a day.' });
        }
        const newBreak = await prisma.breakLog.create({
            data: {
                userId: trainee.id,
                date: today,
                breakOut: new Date(),
                reason: `College Visit: ${collegeName.trim()} (Subject: ${subject.trim()})`,
                status: 'APPROVED'
            }
        });
        res.status(201).json({
            success: true,
            message: `Direct college visit breakout started successfully for ${trainee.fullName}.`,
            breakLog: newBreak
        });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Extra Classes Admin Endpoints ─────────────────────────────────────────────
router.get('/extra-classes', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { status, search, month } = req.query;
        // Dynamic Database-backed clearance check for Supervisors
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_EXTRA_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage extra classes.' });
            }
        }
        let dateFilter = {};
        if (month && typeof month === 'string') {
            const [year, mon] = month.split('-').map(Number);
            const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
            const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
            dateFilter = { date: { gte: startOfMonth, lte: endOfMonth } };
        }
        const searchStr = search;
        const whereClause = {
            ...dateFilter,
        };
        if (status) {
            whereClause.status = status;
        }
        const userConditions = {};
        if (req.user?.role === 'SUPERVISOR') {
            userConditions.supervisors = { some: { id: req.user.id } };
        }
        if (searchStr) {
            userConditions.OR = [
                { fullName: { contains: searchStr, mode: 'insensitive' } },
                { identifier: { contains: searchStr, mode: 'insensitive' } }
            ];
        }
        if (Object.keys(userConditions).length > 0) {
            whereClause.user = userConditions;
        }
        const extraClasses = await prisma.extraClassLog.findMany({
            where: whereClause,
            include: {
                user: { select: { fullName: true, identifier: true, department: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(extraClasses);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/extra-classes/process', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { logId, status, adminReason } = req.body; // status: APPROVED or REJECTED
        if (!logId || !status) {
            return res.status(400).json({ error: 'logId and status are required.' });
        }
        if (status !== 'APPROVED' && status !== 'REJECTED') {
            return res.status(400).json({ error: 'Status must be APPROVED or REJECTED.' });
        }
        if (!adminReason || !adminReason.trim()) {
            return res.status(400).json({ error: 'A remark is required to approve or reject the request.' });
        }
        const log = await prisma.extraClassLog.findUnique({
            where: { id: Number(logId) }
        });
        if (!log) {
            return res.status(404).json({ error: 'Extra class log not found.' });
        }
        // Strict Supervisor Authorization Sandbox & Clearance Checks
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_EXTRA_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage extra classes.' });
            }
            // Check if trainee belongs to supervisor
            const trainee = await prisma.user.findUnique({
                where: { id: log.userId },
                include: { supervisors: true }
            });
            if (!trainee || !trainee.supervisors.some(s => s.id === req.user.id)) {
                return res.status(403).json({ error: 'Access Denied: You can only process extra class requests for trainees assigned to you.' });
            }
        }
        if (log.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request has already been processed.' });
        }
        const updatedLog = await prisma.extraClassLog.update({
            where: { id: Number(logId) },
            data: {
                status,
                adminReason: adminReason ? adminReason.trim() : null
            }
        });
        res.json({ message: `Extra class request ${status.toLowerCase()} successfully.`, extraClass: updatedLog });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/reports/extra-classes/export', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { month, search } = req.query;
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'Month is required' });
        }
        // Dynamic Database-backed clearance check for Supervisors
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_EXTRA_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage extra classes.' });
            }
        }
        const [year, mon] = month.split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
        const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
        const searchStr = search;
        const whereClause = {
            date: { gte: startOfMonth, lte: endOfMonth }
        };
        const userConditions = {};
        if (req.user?.role === 'SUPERVISOR') {
            userConditions.supervisors = { some: { id: req.user.id } };
        }
        if (searchStr) {
            userConditions.OR = [
                { fullName: { contains: searchStr, mode: 'insensitive' } },
                { identifier: { contains: searchStr, mode: 'insensitive' } }
            ];
        }
        if (Object.keys(userConditions).length > 0) {
            whereClause.user = userConditions;
        }
        const logs = await prisma.extraClassLog.findMany({
            where: whereClause,
            include: {
                user: { select: { fullName: true, identifier: true, department: true } }
            },
            orderBy: [
                { date: 'asc' },
                { createdAt: 'asc' }
            ]
        });
        const workbook = new exceljs.Workbook();
        workbook.creator = 'Attendance System';
        // Group logs by teacher/user
        const userMap = new Map();
        logs.forEach(l => {
            const uLogs = userMap.get(l.userId) || [];
            uLogs.push(l);
            userMap.set(l.userId, uLogs);
        });
        if (userMap.size === 0) {
            const ws = workbook.addWorksheet('No Data');
            ws.getCell('A1').value = 'No extra classes found for this month.';
        }
        else {
            const usedNames = new Set();
            for (const [userId, uLogs] of userMap.entries()) {
                const user = uLogs[0].user;
                let sheetName = user.fullName.substring(0, 30);
                let counter = 1;
                while (usedNames.has(sheetName)) {
                    const suffix = `_${counter}`;
                    sheetName = `${user.fullName.substring(0, 30 - suffix.length)}${suffix}`;
                    counter++;
                }
                usedNames.add(sheetName);
                const ws = workbook.addWorksheet(sheetName);
                ws.columns = [
                    { key: 'index', width: 6 },
                    { key: 'date', width: 15 },
                    { key: 'day', width: 12 },
                    { key: 'subject', width: 25 },
                    { key: 'batchNo', width: 15 },
                    { key: 'classMode', width: 15 },
                    { key: 'duration', width: 15 },
                    { key: 'startTime', width: 15 },
                    { key: 'endTime', width: 15 },
                    { key: 'noOfStudents', width: 15 },
                    { key: 'centerName', width: 20 },
                    { key: 'status', width: 15 },
                    { key: 'adminReason', width: 25 },
                    { key: 'remarks', width: 25 }
                ];
                // Title Block (Row 1)
                ws.mergeCells('A1:N1');
                const titleCell = ws.getCell('A1');
                titleCell.value = `EXTRA CLASSES REPORT: ${user.fullName.toUpperCase()} | PHONE: ${user.identifier}`;
                titleCell.font = { bold: true, size: 14, name: 'Calibri' };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(1).height = 40;
                ws.getRow(2).height = 15;
                // Header Row (Row 3)
                const headerRow = ws.getRow(3);
                headerRow.values = [
                    '#',
                    'Date',
                    'Day',
                    'Subject',
                    'Batch No',
                    'Class Mode',
                    'Duration (hrs)',
                    'Start Time',
                    'End Time',
                    'No of Students',
                    'Center Name',
                    'Status',
                    'Supervisor Remarks',
                    'Remarks'
                ];
                headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11, name: 'Calibri' };
                headerRow.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: '2E7D32' } // Dark Green
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
                ws.getRow(3).height = 25;
                // Populate
                let totalApprovedHours = 0;
                uLogs.forEach((l, idx) => {
                    if (l.status === 'APPROVED') {
                        totalApprovedHours += l.duration;
                    }
                    const row = ws.addRow([
                        idx + 1,
                        l.date.toLocaleDateString('en-IN'),
                        l.day,
                        l.subject,
                        l.batchNo,
                        l.classMode || 'OFFLINE',
                        l.duration,
                        l.startTime,
                        l.endTime,
                        l.noOfStudents,
                        l.centerName,
                        l.status,
                        l.adminReason || '--',
                        l.remarks || '--'
                    ]);
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                });
                // Add Spacer Row
                ws.addRow([]);
                // Add Grand Total Row
                const totalRow = ws.addRow([
                    '',
                    'TOTAL APPROVED HOURS',
                    '',
                    '',
                    '',
                    '',
                    totalApprovedHours,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    ''
                ]);
                totalRow.height = 24;
                ws.mergeCells(`B${totalRow.number}:F${totalRow.number}`);
                totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    if (colNumber >= 1 && colNumber <= 14) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: '2E7D32' } // Dark Green
                        };
                        cell.font = {
                            bold: true,
                            name: 'Calibri',
                            size: 11,
                            color: { argb: 'FFFFFFFF' }
                        };
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: colNumber === 7 ? 'center' : (colNumber === 2 ? 'left' : 'center')
                        };
                        cell.border = {
                            top: { style: 'medium', color: { argb: 'FF2E7D32' } },
                            left: { style: 'thin', color: { argb: 'FFFFFF' } },
                            right: { style: 'thin', color: { argb: 'FFFFFF' } },
                            bottom: { style: 'medium', color: { argb: 'FF2E7D32' } }
                        };
                    }
                });
                totalRow.getCell(7).numFmt = '0.0" hrs"';
            }
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Extra_Classes_Report_${month}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Classes Cancelled Admin Endpoints ──────────────────────────────────────────
router.get('/classes-cancelled', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { search, month } = req.query;
        // Dynamic Database-backed clearance check for Supervisors
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_CANCELLED_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage cancelled classes.' });
            }
        }
        let dateFilter = {};
        if (month && typeof month === 'string') {
            const [year, mon] = month.split('-').map(Number);
            const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
            const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
            dateFilter = { date: { gte: startOfMonth, lte: endOfMonth } };
        }
        const searchStr = search;
        const whereClause = {
            ...dateFilter
        };
        const userConditions = {};
        if (req.user?.role === 'SUPERVISOR') {
            userConditions.supervisors = { some: { id: req.user.id } };
        }
        if (searchStr) {
            userConditions.OR = [
                { fullName: { contains: searchStr, mode: 'insensitive' } },
                { identifier: { contains: searchStr, mode: 'insensitive' } }
            ];
        }
        if (Object.keys(userConditions).length > 0) {
            whereClause.user = userConditions;
        }
        const classesCancelled = await prisma.classCancelledLog.findMany({
            where: whereClause,
            include: {
                user: { select: { fullName: true, identifier: true, department: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(classesCancelled);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/reports/classes-cancelled/export', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { month, search } = req.query;
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'Month is required' });
        }
        // Dynamic Database-backed clearance check for Supervisors
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_CANCELLED_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage cancelled classes.' });
            }
        }
        const [year, mon] = month.split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
        const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
        const searchStr = search;
        const whereClause = {
            date: { gte: startOfMonth, lte: endOfMonth }
        };
        const userConditions = {};
        if (req.user?.role === 'SUPERVISOR') {
            userConditions.supervisors = { some: { id: req.user.id } };
        }
        if (searchStr) {
            userConditions.OR = [
                { fullName: { contains: searchStr, mode: 'insensitive' } },
                { identifier: { contains: searchStr, mode: 'insensitive' } }
            ];
        }
        if (Object.keys(userConditions).length > 0) {
            whereClause.user = userConditions;
        }
        const logs = await prisma.classCancelledLog.findMany({
            where: whereClause,
            include: {
                user: { select: { fullName: true, identifier: true, department: true } }
            },
            orderBy: [
                { date: 'asc' },
                { createdAt: 'asc' }
            ]
        });
        const workbook = new exceljs.Workbook();
        workbook.creator = 'Attendance System';
        // Group logs by teacher/user
        const userMap = new Map();
        logs.forEach(l => {
            const uLogs = userMap.get(l.userId) || [];
            uLogs.push(l);
            userMap.set(l.userId, uLogs);
        });
        if (userMap.size === 0) {
            const ws = workbook.addWorksheet('No Data');
            ws.getCell('A1').value = 'No cancelled classes found for this month.';
        }
        else {
            const usedNames = new Set();
            for (const [userId, uLogs] of userMap.entries()) {
                const user = uLogs[0].user;
                let sheetName = user.fullName.substring(0, 30);
                let counter = 1;
                while (usedNames.has(sheetName)) {
                    const suffix = `_${counter}`;
                    sheetName = `${user.fullName.substring(0, 30 - suffix.length)}${suffix}`;
                    counter++;
                }
                usedNames.add(sheetName);
                const ws = workbook.addWorksheet(sheetName);
                ws.columns = [
                    { key: 'index', width: 6 },
                    { key: 'date', width: 15 },
                    { key: 'day', width: 12 },
                    { key: 'subject', width: 25 },
                    { key: 'batchNo', width: 15 },
                    { key: 'centerName', width: 20 },
                    { key: 'reason', width: 25 },
                    { key: 'remarks', width: 35 }
                ];
                // Title Block (Row 1)
                ws.mergeCells('A1:H1');
                const titleCell = ws.getCell('A1');
                titleCell.value = `CANCELLED CLASSES REPORT: ${user.fullName.toUpperCase()} | PHONE: ${user.identifier}`;
                titleCell.font = { bold: true, size: 14, name: 'Calibri' };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(1).height = 40;
                ws.getRow(2).height = 15;
                // Header Row (Row 3)
                const headerRow = ws.getRow(3);
                headerRow.values = [
                    '#',
                    'Date',
                    'Day',
                    'Subject',
                    'Batch No',
                    'Center Name',
                    'Reason',
                    'Remarks'
                ];
                headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11, name: 'Calibri' };
                headerRow.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'C62828' } // Red
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
                ws.getRow(3).height = 25;
                // Populate
                uLogs.forEach((l, idx) => {
                    const row = ws.addRow([
                        idx + 1,
                        l.date.toLocaleDateString('en-IN'),
                        l.day,
                        l.subject,
                        l.batchNo,
                        l.centerName,
                        l.reason || 'Other reasons',
                        l.remarks || '--'
                    ]);
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                });
            }
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Cancelled_Classes_Report_${month}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Admin/Supervisor Logging Actions on Behalf of Trainees ──────────────────
// 1. Log Extra Class
router.post('/extra-classes/log', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { traineeId, date, subject, batchNo, duration, startTime, endTime, noOfStudents, centerName, remarks, classMode } = req.body;
        if (!traineeId || !date || !subject || !batchNo || duration === undefined || !startTime || !endTime || noOfStudents === undefined || !centerName || !classMode) {
            return res.status(400).json({ error: 'All fields (Trainee, Date, Subject, Batch No, Duration, Start Time, End Time, No of Students, Center Name, Class Mode) are required.' });
        }
        const durationVal = parseFloat(duration);
        if (isNaN(durationVal) || durationVal <= 0) {
            return res.status(400).json({ error: 'Duration must be a positive number.' });
        }
        const studentsVal = parseInt(noOfStudents);
        if (isNaN(studentsVal) || studentsVal < 0) {
            return res.status(400).json({ error: 'Number of students must be a valid positive integer.' });
        }
        const parsedDate = new Date(date);
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsedDate.getDay()];
        const extraClass = await prisma.extraClassLog.create({
            data: {
                userId: Number(traineeId),
                date: parsedDate,
                day: dayOfWeek,
                subject: subject.trim(),
                batchNo: batchNo.trim(),
                duration: durationVal,
                startTime: startTime.trim(),
                endTime: endTime.trim(),
                noOfStudents: studentsVal,
                centerName: centerName.trim(),
                remarks: remarks ? remarks.trim() : null,
                classMode: classMode.trim(),
                status: 'APPROVED',
                adminReason: 'Logged directly by Administrator/Supervisor'
            }
        });
        res.status(201).json({ message: 'Extra class logged and approved successfully.', extraClass });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// 2. Log Cancelled Class
router.post('/class-cancelled/log', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { traineeId, date, subject, batchNo, centerName, reason, remarks } = req.body;
        if (!traineeId || !date || !subject || !batchNo || !centerName || !reason) {
            return res.status(400).json({ error: 'All fields (Trainee, Date, Subject, Batch No, Center Name, Reason) are required.' });
        }
        const parsedDate = new Date(date);
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsedDate.getDay()];
        const cancelledClass = await prisma.classCancelledLog.create({
            data: {
                userId: Number(traineeId),
                date: parsedDate,
                day: dayOfWeek,
                subject: subject.trim(),
                batchNo: batchNo.trim(),
                centerName: centerName.trim(),
                reason: reason.trim(),
                remarks: remarks ? remarks.trim() : null
            }
        });
        res.status(201).json({ message: 'Cancelled class logged successfully.', cancelledClass });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// 3. Log Break / College Visit
router.post('/breaks/log', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { traineeId, date, breakType, breakOut, breakIn, reason, bookletNo, collegeName, subject, topicsCovered, conveyance, numberOfHours, fromTime, toTime } = req.body;
        if (!traineeId || !date || !breakType || !breakOut) {
            return res.status(400).json({ error: 'Trainee, Date, Break Type, and Out Time are required.' });
        }
        const parsedDate = new Date(date);
        const parsedBreakOut = new Date(breakOut);
        const parsedBreakIn = breakIn ? new Date(breakIn) : null;
        let breakLog;
        if (breakType === 'COLLEGE_VISIT') {
            if (!bookletNo || !collegeName || !subject || !topicsCovered || !conveyance || !numberOfHours || !fromTime || !toTime) {
                return res.status(400).json({ error: 'All College Visit details are required.' });
            }
            breakLog = await prisma.breakLog.create({
                data: {
                    userId: Number(traineeId),
                    date: parsedDate,
                    breakOut: parsedBreakOut,
                    breakIn: parsedBreakIn || parsedBreakOut, // Save immediately
                    reason: 'College Visit',
                    status: 'APPROVED',
                    bookletNo: bookletNo.trim(),
                    collegeName: collegeName.trim(),
                    subject: subject.trim(),
                    topicsCovered: topicsCovered.trim(),
                    conveyance: conveyance.trim(),
                    numberOfHours: numberOfHours.trim(),
                    fromTime: fromTime.trim(),
                    toTime: toTime.trim()
                }
            });
        }
        else {
            breakLog = await prisma.breakLog.create({
                data: {
                    userId: Number(traineeId),
                    date: parsedDate,
                    breakOut: parsedBreakOut,
                    breakIn: parsedBreakIn,
                    reason: reason ? reason.trim() : 'Manual Break Entry',
                    status: 'APPROVED'
                }
            });
        }
        res.status(201).json({ message: 'Break record logged successfully.', breakLog });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// 4. Edit Break / College Visit Log
router.put('/breaks/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { traineeId, date, breakType, breakOut, breakIn, reason, bookletNo, collegeName, subject, topicsCovered, conveyance, numberOfHours, fromTime, toTime } = req.body;
        if (!traineeId || !date || !breakType || !breakOut) {
            return res.status(400).json({ error: 'Trainee, Date, Break Type, and Out Time are required.' });
        }
        const logId = Number(id);
        const breakLog = await prisma.breakLog.findUnique({
            where: { id: logId },
            include: { user: { include: { supervisors: true } } }
        });
        if (!breakLog) {
            return res.status(404).json({ error: 'Break record not found.' });
        }
        // Supervisor clearance check
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_BREAKS')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage breaks.' });
            }
            const isAssigned = breakLog.user.supervisors.some(s => s.id === req.user.id);
            if (!isAssigned || Number(traineeId) !== breakLog.userId) {
                // Also check if trainee belongs to supervisor if they changed the trainee
                const trainee = await prisma.user.findUnique({
                    where: { id: Number(traineeId) },
                    include: { supervisors: true }
                });
                if (!trainee || !trainee.supervisors.some(s => s.id === req.user.id)) {
                    return res.status(403).json({ error: 'Access Denied: You can only edit breaks for trainees assigned under you.' });
                }
            }
        }
        const parsedDate = new Date(date);
        const parsedBreakOut = new Date(breakOut);
        const parsedBreakIn = breakIn ? new Date(breakIn) : null;
        let updatedBreakLog;
        if (breakType === 'COLLEGE_VISIT') {
            if (!bookletNo || !collegeName || !subject || !topicsCovered || !conveyance || !numberOfHours || !fromTime || !toTime) {
                return res.status(400).json({ error: 'All College Visit details are required.' });
            }
            updatedBreakLog = await prisma.breakLog.update({
                where: { id: logId },
                data: {
                    userId: Number(traineeId),
                    date: parsedDate,
                    breakOut: parsedBreakOut,
                    breakIn: parsedBreakIn || parsedBreakOut,
                    reason: 'College Visit',
                    bookletNo: bookletNo.trim(),
                    collegeName: collegeName.trim(),
                    subject: subject.trim(),
                    topicsCovered: topicsCovered.trim(),
                    conveyance: conveyance.trim(),
                    numberOfHours: numberOfHours.trim(),
                    fromTime: fromTime.trim(),
                    toTime: toTime.trim()
                }
            });
        }
        else {
            updatedBreakLog = await prisma.breakLog.update({
                where: { id: logId },
                data: {
                    userId: Number(traineeId),
                    date: parsedDate,
                    breakOut: parsedBreakOut,
                    breakIn: parsedBreakIn,
                    reason: reason ? reason.trim() : 'Manual Break Entry',
                    bookletNo: null,
                    collegeName: null,
                    subject: null,
                    topicsCovered: null,
                    conveyance: null,
                    numberOfHours: null,
                    fromTime: null,
                    toTime: null
                }
            });
        }
        res.status(200).json({ message: 'Break record updated successfully.', breakLog: updatedBreakLog });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// 5. Edit Extra Class Log
router.put('/extra-classes/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { traineeId, date, subject, batchNo, duration, startTime, endTime, noOfStudents, centerName, remarks, classMode } = req.body;
        if (!traineeId || !date || !subject || !batchNo || duration === undefined || !startTime || !endTime || noOfStudents === undefined || !centerName || !classMode) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const durationVal = parseFloat(duration);
        if (isNaN(durationVal) || durationVal <= 0) {
            return res.status(400).json({ error: 'Duration must be a positive number.' });
        }
        const studentsVal = parseInt(noOfStudents);
        if (isNaN(studentsVal) || studentsVal < 0) {
            return res.status(400).json({ error: 'Number of students must be a valid positive integer.' });
        }
        const logId = Number(id);
        const log = await prisma.extraClassLog.findUnique({
            where: { id: logId }
        });
        if (!log) {
            return res.status(404).json({ error: 'Extra class log not found.' });
        }
        // Supervisor Clearance check
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_EXTRA_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage extra classes.' });
            }
            const trainee = await prisma.user.findUnique({
                where: { id: log.userId },
                include: { supervisors: true }
            });
            if (!trainee || !trainee.supervisors.some(s => s.id === req.user.id)) {
                return res.status(403).json({ error: 'Access Denied: You can only edit extra class requests for trainees assigned to you.' });
            }
        }
        const parsedDate = new Date(date);
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsedDate.getDay()];
        const updatedExtraClass = await prisma.extraClassLog.update({
            where: { id: logId },
            data: {
                userId: Number(traineeId),
                date: parsedDate,
                day: dayOfWeek,
                subject: subject.trim(),
                batchNo: batchNo.trim(),
                duration: durationVal,
                startTime: startTime.trim(),
                endTime: endTime.trim(),
                noOfStudents: studentsVal,
                centerName: centerName.trim(),
                remarks: remarks ? remarks.trim() : null,
                classMode: classMode.trim()
            }
        });
        res.status(200).json({ message: 'Extra class updated successfully.', extraClass: updatedExtraClass });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// 6. Edit Cancelled Class Log
router.put('/class-cancelled/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { traineeId, date, subject, batchNo, centerName, reason, remarks } = req.body;
        if (!traineeId || !date || !subject || !batchNo || !centerName || !reason) {
            return res.status(400).json({ error: 'All fields are required.' });
        }
        const logId = Number(id);
        const log = await prisma.classCancelledLog.findUnique({
            where: { id: logId }
        });
        if (!log) {
            return res.status(404).json({ error: 'Cancelled class log not found.' });
        }
        // Supervisor Clearance check
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_CANCELLED_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage cancelled classes.' });
            }
            const trainee = await prisma.user.findUnique({
                where: { id: log.userId },
                include: { supervisors: true }
            });
            if (!trainee || !trainee.supervisors.some(s => s.id === req.user.id)) {
                return res.status(403).json({ error: 'Access Denied: You can only edit cancelled class requests for trainees assigned to you.' });
            }
        }
        const parsedDate = new Date(date);
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsedDate.getDay()];
        const updatedCancelledClass = await prisma.classCancelledLog.update({
            where: { id: logId },
            data: {
                userId: Number(traineeId),
                date: parsedDate,
                day: dayOfWeek,
                subject: subject.trim(),
                batchNo: batchNo.trim(),
                centerName: centerName.trim(),
                reason: reason.trim(),
                remarks: remarks ? remarks.trim() : null
            }
        });
        res.status(200).json({ message: 'Cancelled class updated successfully.', cancelledClass: updatedCancelledClass });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Other Center Classes Admin Endpoints ──────────────────────────────────────────
router.get('/other-center-classes', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { status, search, month } = req.query;
        // Dynamic Database-backed clearance check for Supervisors
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_OTHER_CENTER_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage other center classes.' });
            }
        }
        let dateFilter = {};
        if (month && typeof month === 'string') {
            const [year, mon] = month.split('-').map(Number);
            const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
            const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
            dateFilter = { date: { gte: startOfMonth, lte: endOfMonth } };
        }
        const searchStr = search;
        const whereClause = {
            ...dateFilter,
        };
        if (status) {
            whereClause.status = status;
        }
        const userConditions = {};
        if (req.user?.role === 'SUPERVISOR') {
            userConditions.supervisors = { some: { id: req.user.id } };
        }
        if (searchStr) {
            userConditions.OR = [
                { fullName: { contains: searchStr, mode: 'insensitive' } },
                { identifier: { contains: searchStr, mode: 'insensitive' } }
            ];
        }
        if (Object.keys(userConditions).length > 0) {
            whereClause.user = userConditions;
        }
        const otherCenterClasses = await prisma.otherCenterClassLog.findMany({
            where: whereClause,
            include: {
                user: { select: { fullName: true, identifier: true, department: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json(otherCenterClasses);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/other-center-classes/process', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { logId, status, adminReason } = req.body; // status: APPROVED or REJECTED
        if (!logId || !status) {
            return res.status(400).json({ error: 'logId and status are required.' });
        }
        if (status !== 'APPROVED' && status !== 'REJECTED') {
            return res.status(400).json({ error: 'Status must be APPROVED or REJECTED.' });
        }
        if (!adminReason || !adminReason.trim()) {
            return res.status(400).json({ error: 'A remark is required to approve or reject the request.' });
        }
        const log = await prisma.otherCenterClassLog.findUnique({
            where: { id: Number(logId) }
        });
        if (!log) {
            return res.status(404).json({ error: 'Other center class log not found.' });
        }
        // Strict Supervisor Authorization Sandbox & Clearance Checks
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_OTHER_CENTER_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage other center classes.' });
            }
            // Check if trainee belongs to supervisor
            const trainee = await prisma.user.findUnique({
                where: { id: log.userId },
                include: { supervisors: true }
            });
            if (!trainee || !trainee.supervisors.some(s => s.id === req.user.id)) {
                return res.status(403).json({ error: 'Access Denied: You can only process other center class requests for trainees assigned to you.' });
            }
        }
        if (log.status !== 'PENDING') {
            return res.status(400).json({ error: 'Request has already been processed.' });
        }
        const updatedLog = await prisma.otherCenterClassLog.update({
            where: { id: Number(logId) },
            data: {
                status,
                adminReason: adminReason ? adminReason.trim() : null
            }
        });
        res.json({ message: `Other center class request ${status.toLowerCase()} successfully.`, otherCenterClass: updatedLog });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.get('/reports/other-center-classes/export', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { month, search } = req.query;
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'Month is required' });
        }
        // Dynamic Database-backed clearance check for Supervisors
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_OTHER_CENTER_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage other center classes.' });
            }
        }
        const [year, mon] = month.split('-').map(Number);
        const startOfMonth = new Date(Date.UTC(year, mon - 1, 1, 0, 0, 0) - (5.5 * 60 * 60 * 1000));
        const endOfMonth = new Date(Date.UTC(year, mon, 0, 23, 59, 59, 999) - (5.5 * 60 * 60 * 1000));
        const searchStr = search;
        const whereClause = {
            date: { gte: startOfMonth, lte: endOfMonth }
        };
        const userConditions = {};
        if (req.user?.role === 'SUPERVISOR') {
            userConditions.supervisors = { some: { id: req.user.id } };
        }
        if (searchStr) {
            userConditions.OR = [
                { fullName: { contains: searchStr, mode: 'insensitive' } },
                { identifier: { contains: searchStr, mode: 'insensitive' } }
            ];
        }
        if (Object.keys(userConditions).length > 0) {
            whereClause.user = userConditions;
        }
        const logs = await prisma.otherCenterClassLog.findMany({
            where: whereClause,
            include: {
                user: { select: { fullName: true, identifier: true, department: true } }
            },
            orderBy: [
                { date: 'asc' },
                { createdAt: 'asc' }
            ]
        });
        const workbook = new exceljs.Workbook();
        workbook.creator = 'Attendance System';
        // Group logs by teacher/user
        const userMap = new Map();
        logs.forEach(l => {
            const uLogs = userMap.get(l.userId) || [];
            uLogs.push(l);
            userMap.set(l.userId, uLogs);
        });
        if (userMap.size === 0) {
            const ws = workbook.addWorksheet('No Data');
            ws.getCell('A1').value = 'No other center classes found for this month.';
        }
        else {
            const usedNames = new Set();
            for (const [userId, uLogs] of userMap.entries()) {
                const user = uLogs[0].user;
                let sheetName = user.fullName.substring(0, 30);
                let counter = 1;
                while (usedNames.has(sheetName)) {
                    const suffix = `_${counter}`;
                    sheetName = `${user.fullName.substring(0, 30 - suffix.length)}${suffix}`;
                    counter++;
                }
                usedNames.add(sheetName);
                const ws = workbook.addWorksheet(sheetName);
                ws.columns = [
                    { key: 'index', width: 6 },
                    { key: 'date', width: 15 },
                    { key: 'day', width: 12 },
                    { key: 'subject', width: 25 },
                    { key: 'batchNo', width: 15 },
                    { key: 'classMode', width: 15 },
                    { key: 'duration', width: 15 },
                    { key: 'startTime', width: 15 },
                    { key: 'endTime', width: 15 },
                    { key: 'noOfStudents', width: 15 },
                    { key: 'centerName', width: 20 },
                    { key: 'status', width: 15 },
                    { key: 'adminReason', width: 25 },
                    { key: 'remarks', width: 25 }
                ];
                // Title Block (Row 1)
                ws.mergeCells('A1:N1');
                const titleCell = ws.getCell('A1');
                titleCell.value = `OTHER CENTER CLASSES REPORT: ${user.fullName.toUpperCase()} | PHONE: ${user.identifier}`;
                titleCell.font = { bold: true, size: 14, name: 'Calibri' };
                titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
                ws.getRow(1).height = 40;
                ws.getRow(2).height = 15;
                // Header Row (Row 3)
                const headerRow = ws.getRow(3);
                headerRow.values = [
                    '#',
                    'Date',
                    'Day',
                    'Subject',
                    'Batch No',
                    'Class Mode',
                    'Duration (hrs)',
                    'Start Time',
                    'End Time',
                    'No of Students',
                    'Center Name',
                    'Status',
                    'Supervisor Remarks',
                    'Remarks'
                ];
                headerRow.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11, name: 'Calibri' };
                headerRow.eachCell((cell) => {
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: '2E7D32' } // Dark Green
                    };
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                });
                ws.getRow(3).height = 25;
                // Populate
                let totalApprovedHours = 0;
                uLogs.forEach((l, idx) => {
                    if (l.status === 'APPROVED') {
                        totalApprovedHours += l.duration;
                    }
                    const row = ws.addRow([
                        idx + 1,
                        l.date.toLocaleDateString('en-IN'),
                        l.day,
                        l.subject,
                        l.batchNo,
                        l.classMode || 'OFFLINE',
                        l.duration,
                        l.startTime,
                        l.endTime,
                        l.noOfStudents,
                        l.centerName,
                        l.status,
                        l.adminReason || '--',
                        l.remarks || '--'
                    ]);
                    row.eachCell((cell) => {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                });
                // Add Spacer Row
                ws.addRow([]);
                // Add Grand Total Row
                const totalRow = ws.addRow([
                    '',
                    'TOTAL APPROVED HOURS',
                    '',
                    '',
                    '',
                    '',
                    totalApprovedHours,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                    ''
                ]);
                totalRow.height = 24;
                ws.mergeCells(`B${totalRow.number}:F${totalRow.number}`);
                totalRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    if (colNumber >= 1 && colNumber <= 14) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: '2E7D32' } // Dark Green
                        };
                        cell.font = {
                            bold: true,
                            name: 'Calibri',
                            size: 11,
                            color: { argb: 'FFFFFFFF' }
                        };
                        cell.alignment = {
                            vertical: 'middle',
                            horizontal: colNumber === 7 ? 'center' : (colNumber === 2 ? 'left' : 'center')
                        };
                        cell.border = {
                            top: { style: 'medium', color: { argb: 'FF2E7D32' } },
                            left: { style: 'thin', color: { argb: 'FFFFFF' } },
                            right: { style: 'thin', color: { argb: 'FFFFFF' } },
                            bottom: { style: 'medium', color: { argb: 'FF2E7D32' } }
                        };
                    }
                });
                totalRow.getCell(7).numFmt = '0.0" hrs"';
            }
        }
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Other_Center_Classes_Report_${month}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/other-center-classes/log', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { traineeId, date, subject, batchNo, duration, startTime, endTime, noOfStudents, centerName, remarks, classMode } = req.body;
        if (!traineeId || !date || !subject || !batchNo || duration === undefined || !startTime || !endTime || noOfStudents === undefined || !centerName || !classMode) {
            return res.status(400).json({ error: 'All fields (Trainee, Date, Subject, Batch No, Duration, Start Time, End Time, No of Students, Center Name, Class Mode) are required.' });
        }
        const durationVal = parseFloat(duration);
        if (isNaN(durationVal) || durationVal <= 0) {
            return res.status(400).json({ error: 'Duration must be a positive number.' });
        }
        const studentsVal = parseInt(noOfStudents);
        if (isNaN(studentsVal) || studentsVal < 0) {
            return res.status(400).json({ error: 'Number of students must be a valid positive integer.' });
        }
        const parsedDate = new Date(date);
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsedDate.getDay()];
        const otherCenterClass = await prisma.otherCenterClassLog.create({
            data: {
                userId: Number(traineeId),
                date: parsedDate,
                day: dayOfWeek,
                subject: subject.trim(),
                batchNo: batchNo.trim(),
                duration: durationVal,
                startTime: startTime.trim(),
                endTime: endTime.trim(),
                noOfStudents: studentsVal,
                centerName: centerName.trim(),
                remarks: remarks ? remarks.trim() : null,
                classMode: classMode.trim(),
                status: 'APPROVED',
                adminReason: 'Logged directly by Administrator/Supervisor'
            }
        });
        res.status(201).json({ message: 'Other center class logged and approved successfully.', otherCenterClass });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.put('/other-center-classes/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { traineeId, date, subject, batchNo, duration, startTime, endTime, noOfStudents, centerName, remarks, classMode } = req.body;
        if (!traineeId || !date || !subject || !batchNo || duration === undefined || !startTime || !endTime || noOfStudents === undefined || !centerName || !classMode) {
            return res.status(400).json({ error: 'All fields (Trainee, Date, Subject, Batch No, Duration, Start Time, End Time, No of Students, Center Name, Class Mode) are required.' });
        }
        const durationVal = parseFloat(duration);
        if (isNaN(durationVal) || durationVal <= 0) {
            return res.status(400).json({ error: 'Duration must be a positive number.' });
        }
        const studentsVal = parseInt(noOfStudents);
        if (isNaN(studentsVal) || studentsVal < 0) {
            return res.status(400).json({ error: 'Number of students must be a valid positive integer.' });
        }
        const logId = Number(id);
        const log = await prisma.otherCenterClassLog.findUnique({
            where: { id: logId }
        });
        if (!log) {
            return res.status(404).json({ error: 'Other center class log not found.' });
        }
        // Supervisor Clearance check
        if (req.user?.role === 'SUPERVISOR') {
            const supervisor = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: { permissions: true }
            });
            const perms = supervisor?.permissions ? supervisor.permissions.split(',') : [];
            if (!perms.includes('MANAGE_OTHER_CENTER_CLASSES')) {
                return res.status(403).json({ error: 'Access Denied: You do not have clearance to manage other center classes.' });
            }
            const trainee = await prisma.user.findUnique({
                where: { id: log.userId },
                include: { supervisors: true }
            });
            if (!trainee || !trainee.supervisors.some(s => s.id === req.user.id)) {
                return res.status(403).json({ error: 'Access Denied: You can only edit other center class requests for trainees assigned to you.' });
            }
        }
        const parsedDate = new Date(date);
        const dayOfWeek = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][parsedDate.getDay()];
        const updatedOtherCenterClass = await prisma.otherCenterClassLog.update({
            where: { id: logId },
            data: {
                userId: Number(traineeId),
                date: parsedDate,
                day: dayOfWeek,
                subject: subject.trim(),
                batchNo: batchNo.trim(),
                duration: durationVal,
                startTime: startTime.trim(),
                endTime: endTime.trim(),
                noOfStudents: studentsVal,
                centerName: centerName.trim(),
                classMode: classMode.trim(),
                remarks: remarks ? remarks.trim() : null
            }
        });
        res.status(200).json({ message: 'Other center class updated successfully.', otherCenterClass: updatedOtherCenterClass });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map