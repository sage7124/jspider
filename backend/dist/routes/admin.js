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
router.use(authMiddleware_1.authenticateToken);
router.use(authMiddleware_1.requireAdmin);
// ── GET all trainees with today's attendance ──────────────────────────────────
router.get('/attendance', async (_req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { search } = _req.query;
        const users = await prisma.user.findMany({
            where: {
                role: 'TRAINEE',
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
                totalLeaves: user.totalLeaves,
                leaveBalance: user.leaveBalance,
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
        const { fullName, identifier, email, totalLeaves } = req.body;
        const updateData = { fullName, identifier, email };
        if (totalLeaves !== undefined) {
            updateData.totalLeaves = Number(totalLeaves);
            // If updating total leaves, we usually want to reset/adjust the balance too.
            // For now, let's keep it simple and reset balance to total if total is changed.
            updateData.leaveBalance = Number(totalLeaves);
        }
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
        const { traineeId, startDate, endDate, reason } = req.body;
        const start = new Date(startDate);
        const end = new Date(endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({ error: 'Invalid dates' });
        }
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        const user = await prisma.user.findUnique({ where: { id: Number(traineeId) } });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        if (user.leaveBalance < days) {
            return res.status(400).json({ error: `Insufficient leave balance. Remaining: ${user.leaveBalance}` });
        }
        await prisma.$transaction([
            prisma.leaveRequest.create({
                data: {
                    userId: Number(traineeId),
                    startDate: start,
                    endDate: end,
                    reason: reason || 'Direct leave by admin',
                    status: 'APPROVED',
                    adminReason: 'Direct assignment'
                }
            }),
            prisma.user.update({
                where: { id: Number(traineeId) },
                data: { leaveBalance: { decrement: days } }
            })
        ]);
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
        const trainees = await prisma.user.findMany({
            where: { role: 'TRAINEE' },
            orderBy: { fullName: 'asc' },
            include: { attendances: { where: { date: targetDate } } }
        });
        const result = trainees.map(t => {
            const att = t.attendances[0];
            const status = att ? att.status : 'ABSENT';
            return {
                id: t.id,
                name: t.fullName,
                empCode: t.identifier,
                status,
                inTime: att?.inTime ? new Date(att.inTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime: att?.outTime ? new Date(att.outTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'
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
        const startOfMonth = new Date(year, mon - 1, 1);
        const endOfMonth = new Date(year, mon, 0, 23, 59, 59);
        const daysInMonth = endOfMonth.getDate();
        const trainees = await prisma.user.findMany({
            where: { role: 'TRAINEE' },
            include: { slots: true },
            orderBy: { fullName: 'asc' }
        });
        const attendances = await prisma.attendance.findMany({
            where: { date: { gte: startOfMonth, lte: endOfMonth } },
            orderBy: { date: 'asc' }
        });
        const workbook = new exceljs.Workbook();
        workbook.creator = 'Attendance System';
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
            (0, excel_1.generateTraineeWorksheet)(ws, trainee, traineeAtts, year, mon, daysInMonth);
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
        const startOfMonth = new Date(year, mon - 1, 1);
        const endOfMonth = new Date(year, mon, 0, 23, 59, 59);
        const daysInMonth = endOfMonth.getDate();
        const attendances = await prisma.attendance.findMany({
            where: { userId, date: { gte: startOfMonth, lte: endOfMonth } },
            orderBy: { date: 'asc' }
        });
        const workbook = new exceljs.Workbook();
        const ws = workbook.addWorksheet(`${user.fullName.substring(0, 20)} Report`);
        (0, excel_1.generateTraineeWorksheet)(ws, user, attendances, year, mon, daysInMonth);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=Report_${user.fullName}_${month}.xlsx`);
        await workbook.xlsx.write(res);
        res.end();
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Settings ──────────────────────────────────────────────────────────────────
router.get('/settings', async (_req, res) => {
    try {
        let settings = await prisma.instituteSettings.findFirst();
        if (!settings) {
            settings = await prisma.instituteSettings.create({
                data: { lat: 12.9716, lng: 77.5946, radius: 500 },
            });
        }
        res.json(settings);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch settings' });
    }
});
router.put('/settings', async (req, res) => {
    try {
        const { lat, lng, radius } = req.body;
        const settings = await prisma.instituteSettings.findFirst();
        if (settings) {
            await prisma.instituteSettings.update({
                where: { id: settings.id },
                data: { lat: Number(lat), lng: Number(lng), radius: Number(radius) },
            });
        }
        else {
            await prisma.instituteSettings.create({
                data: { lat: Number(lat), lng: Number(lng), radius: Number(radius) },
            });
        }
        res.json({ message: 'Settings updated' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update settings' });
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
            const days = Math.ceil((finalEndDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            if (request.user.leaveBalance < days) {
                return res.status(400).json({ error: 'Insufficient leave balance' });
            }
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
// ── Reset Device Locks ───────────────────────────────────────────────────────
router.post('/reset-device/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'mobile', 'desktop', or 'both'
        const data = {};
        if (type === 'mobile' || type === 'both')
            data.mobileDeviceId = null;
        if (type === 'desktop' || type === 'both')
            data.desktopDeviceId = null;
        await prisma.user.update({ where: { id: Number(id) }, data });
        res.json({ message: `Device lock (${type}) reset successfully` });
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ── Find User by Device ID ───────────────────────────────────────────────────
router.get('/device/:deviceId', async (req, res) => {
    try {
        const { deviceId } = req.params;
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { mobileDeviceId: deviceId },
                    { desktopDeviceId: deviceId }
                ]
            },
            select: { id: true, identifier: true, fullName: true, role: true }
        });
        if (!user)
            return res.status(404).json({ error: 'No user found with this device ID' });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
});
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
// ── Manual Attendance Edit ──────────────────────────────────────────────────
router.put('/attendance-manual/:traineeId', async (req, res) => {
    try {
        const { traineeId } = req.params;
        const { inTime, outTime, status, date } = req.body; // inTime/outTime format "HH:mm"
        // Use provided date or fallback to today
        const targetDate = date ? new Date(date) : new Date();
        targetDate.setHours(0, 0, 0, 0);
        const updateData = {};
        if (status)
            updateData.status = status;
        const setTime = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            const d = new Date(targetDate);
            d.setHours(h, m, 0, 0);
            return d;
        };
        if (inTime && inTime !== '--')
            updateData.inTime = setTime(inTime);
        if (outTime && outTime !== '--')
            updateData.outTime = setTime(outTime);
        await prisma.attendance.upsert({
            where: { userId_date: { userId: Number(traineeId), date: targetDate } },
            update: updateData,
            create: {
                userId: Number(traineeId),
                date: targetDate,
                ...updateData,
                status: status || 'OUT'
            }
        });
        res.json({ message: 'Attendance updated manually' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=admin.js.map