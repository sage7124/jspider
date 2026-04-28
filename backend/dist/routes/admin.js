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
// ── Download Monthly Excel Report ─────────────────────────────────────────────
router.get('/reports/monthly', async (req, res) => {
    try {
        const { month } = req.query; // e.g., "2026-04"
        let dateFilter = {};
        if (month && typeof month === 'string') {
            const [year, mon] = month.split('-').map(Number);
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
            { header: 'Slot-1 Start', key: 's1Start', width: 15 },
            { header: 'Slot-1 End', key: 's1End', width: 15 },
            { header: 'Slot-2 Start', key: 's2Start', width: 15 },
            { header: 'Slot-2 End', key: 's2End', width: 15 },
            { header: 'Slot-3 Start', key: 's3Start', width: 15 },
            { header: 'Slot-3 End', key: 's3End', width: 15 },
            { header: 'Late', key: 'isLate', width: 10 },
            { header: 'Early Departure', key: 'isEarly', width: 15 },
        ];
        // Style header row
        ws.getRow(1).font = { bold: true };
        ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1976D2' } };
        ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        const attendances = await prisma.attendance.findMany({
            where: dateFilter,
            include: { user: { include: { slots: true } } },
            orderBy: [{ date: 'asc' }, { user: { fullName: 'asc' } }],
        });
        // If no attendances for month, still include all trainees as ABSENT
        if (attendances.length === 0) {
            const trainees = await prisma.user.findMany({ where: { role: 'TRAINEE' }, include: { slots: true } });
            trainees.forEach((t) => {
                ws.addRow({
                    empCode: t.identifier,
                    name: t.fullName,
                    dept: t.department || '--',
                    date: month ? `${month}` : '--',
                    inTime: '--',
                    outTime: '--',
                    s1Start: '--',
                    s1End: '--',
                    s2Start: '--',
                    s2End: '--',
                    s3Start: '--',
                    s3End: '--',
                    isLate: 'No',
                    isEarly: 'No'
                });
            });
        }
        else {
            attendances.forEach((att) => {
                const dayStr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][att.date.getDay()];
                const daySlots = att.user.slots.filter(s => s.dayOfWeek === dayStr).sort((a, b) => a.slotNo - b.slotNo);
                const s1 = daySlots.find(s => s.slotNo === 1);
                const s2 = daySlots.find(s => s.slotNo === 2);
                const s3 = daySlots.find(s => s.slotNo === 3);
                let isEarly = 'No';
                if (att.outTime && daySlots.length > 0) {
                    const lastSlot = daySlots[daySlots.length - 1];
                    const [time, mod] = lastSlot.endTime.split(' ');
                    let [h, m] = time.split(':').map(Number);
                    if (mod === 'PM' && h < 12)
                        h += 12;
                    if (mod === 'AM' && h === 12)
                        h = 0;
                    const slotEnd = new Date(att.date);
                    slotEnd.setHours(h, m, 0, 0);
                    if (att.outTime.getTime() < slotEnd.getTime()) {
                        isEarly = 'Yes';
                    }
                }
                ws.addRow({
                    empCode: att.user.identifier,
                    name: att.user.fullName,
                    dept: att.user.department || '--',
                    date: att.date.toLocaleDateString('en-IN'),
                    inTime: att.inTime ? att.inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                    outTime: att.outTime ? att.outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                    s1Start: s1?.startTime || '--',
                    s1End: s1?.endTime || '--',
                    s2Start: s2?.startTime || '--',
                    s2End: s2?.endTime || '--',
                    s3Start: s3?.startTime || '--',
                    s3End: s3?.endTime || '--',
                    isLate: att.isLate ? 'Yes' : 'No',
                    isEarly: isEarly
                });
            });
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
        const { month } = req.query; // e.g., "2026-04"
        if (!month || typeof month !== 'string') {
            return res.status(400).json({ error: 'Month is required' });
        }
        const user = await prisma.user.findUnique({
            where: { id: userId },
            include: { slots: true }
        });
        if (!user)
            return res.status(404).json({ error: 'User not found' });
        const [year, mon] = month.split('-').map(Number);
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
            { header: 'Slot-1 Start', key: 's1Start', width: 12 },
            { header: 'Slot-1 End', key: 's1End', width: 12 },
            { header: 'S1 Late', key: 's1Late', width: 10 },
            { header: 'S1 Early', key: 's1Early', width: 10 },
            { header: 'Slot-2 Start', key: 's2Start', width: 12 },
            { header: 'Slot-2 End', key: 's2End', width: 12 },
            { header: 'S2 Late', key: 's2Late', width: 10 },
            { header: 'S2 Early', key: 's2Early', width: 10 },
            { header: 'Slot-3 Start', key: 's3Start', width: 12 },
            { header: 'Slot-3 End', key: 's3End', width: 12 },
            { header: 'S3 Late', key: 's3Late', width: 10 },
            { header: 'S3 Early', key: 's3Early', width: 10 },
            { header: 'Worked Hours', key: 'worked', width: 15 },
            { header: 'Total Late', key: 'late', width: 12 },
            { header: 'Total Early', key: 'earlyDeparture', width: 12 }
        ];
        ws.getRow(1).font = { bold: true };
        const daysInMonth = endOfMonth.getDate();
        let totalWorkedMinutes = 0;
        let totalLateMinutes = 0;
        for (let day = 1; day <= daysInMonth; day++) {
            const currentDate = new Date(year, mon - 1, day);
            const dayStr = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][currentDate.getDay()];
            const daySlots = user.slots.filter(s => s.dayOfWeek === dayStr).sort((a, b) => a.slotNo - b.slotNo);
            const att = attendances.find(a => a.date.getDate() === day && a.date.getMonth() === (mon - 1));
            const s1 = daySlots.find(s => s.slotNo === 1);
            const s2 = daySlots.find(s => s.slotNo === 2);
            const s3 = daySlots.find(s => s.slotNo === 3);
            let workedHours = '--';
            let totalLateMins = 0;
            let totalEarlyMins = 0;
            const calcLate = (slot, inTime) => {
                if (!slot || !inTime)
                    return '--';
                const [time, mod] = slot.startTime.split(' ');
                let [h, m] = time.split(':').map(Number);
                if (mod === 'PM' && h < 12)
                    h += 12;
                if (mod === 'AM' && h === 12)
                    h = 0;
                const start = new Date(currentDate);
                start.setHours(h, m, 0, 0);
                if (inTime.getTime() > start.getTime()) {
                    const diff = inTime.getTime() - start.getTime();
                    const mins = Math.floor(diff / 60000);
                    return mins;
                }
                return 0;
            };
            const calcEarly = (slot, outTime) => {
                if (!slot || !outTime)
                    return '--';
                const [time, mod] = slot.endTime.split(' ');
                let [h, m] = time.split(':').map(Number);
                if (mod === 'PM' && h < 12)
                    h += 12;
                if (mod === 'AM' && h === 12)
                    h = 0;
                const end = new Date(currentDate);
                end.setHours(h, m, 0, 0);
                if (outTime.getTime() < end.getTime()) {
                    const diff = end.getTime() - outTime.getTime();
                    const mins = Math.floor(diff / 60000);
                    return mins;
                }
                return 0;
            };
            let s1L = '--', s1E = '--', s2L = '--', s2E = '--', s3L = '--', s3E = '--';
            if (att) {
                if (att.inTime && att.outTime) {
                    const diff = att.outTime.getTime() - att.inTime.getTime();
                    const mins = Math.floor(diff / 60000);
                    totalWorkedMinutes += mins;
                    workedHours = `${Math.floor(mins / 60)}h ${mins % 60}m`;
                }
                if (att.inTime) {
                    const l1 = calcLate(s1, att.inTime);
                    const l2 = calcLate(s2, att.inTime);
                    const l3 = calcLate(s3, att.inTime);
                    if (typeof l1 === 'number') {
                        s1L = `${l1}m`;
                        totalLateMins += l1;
                    }
                    if (typeof l2 === 'number') {
                        s2L = `${l2}m`;
                        totalLateMins += l2;
                    }
                    if (typeof l3 === 'number') {
                        s3L = `${l3}m`;
                        totalLateMins += l3;
                    }
                }
                if (att.outTime) {
                    const e1 = calcEarly(s1, att.outTime);
                    const e2 = calcEarly(s2, att.outTime);
                    const e3 = calcEarly(s3, att.outTime);
                    if (typeof e1 === 'number') {
                        s1E = `${e1}m`;
                        totalEarlyMins += e1;
                    }
                    if (typeof e2 === 'number') {
                        s2E = `${e2}m`;
                        totalEarlyMins += e2;
                    }
                    if (typeof e3 === 'number') {
                        s3E = `${e3}m`;
                        totalEarlyMins += e3;
                    }
                }
            }
            totalLateMinutes += totalLateMins;
            ws.addRow({
                si: day,
                date: currentDate.toLocaleDateString('en-IN'),
                empCode: day === 1 ? user.identifier : '',
                name: day === 1 ? user.fullName : '',
                dept: day === 1 ? (user.department || '--') : '',
                inTime: att?.inTime ? att.inTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                outTime: att?.outTime ? att.outTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--',
                s1Start: s1?.startTime || '--',
                s1End: s1?.endTime || '--',
                s1Late: s1L,
                s1Early: s1E,
                s2Start: s2?.startTime || '--',
                s2End: s2?.endTime || '--',
                s2Late: s2L,
                s2Early: s2E,
                s3Start: s3?.startTime || '--',
                s3End: s3?.endTime || '--',
                s3Late: s3L,
                s3Early: s3E,
                worked: workedHours,
                late: totalLateMins > 0 ? `${Math.floor(totalLateMins / 60)}h ${totalLateMins % 60}m` : '0m',
                earlyDeparture: totalEarlyMins > 0 ? `${Math.floor(totalEarlyMins / 60)}h ${totalEarlyMins % 60}m` : '0m'
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
        const { requestId, status } = req.body; // status: APPROVED or REJECTED
        const request = await prisma.leaveRequest.findUnique({
            where: { id: requestId },
            include: { user: true }
        });
        if (!request)
            return res.status(404).json({ error: 'Request not found' });
        if (request.status !== 'PENDING')
            return res.status(400).json({ error: 'Request already processed' });
        if (status === 'APPROVED') {
            // Calculate days
            const days = Math.ceil((request.endDate.getTime() - request.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            if (request.user.leaveBalance < days) {
                return res.status(400).json({ error: 'Insufficient leave balance' });
            }
            await prisma.$transaction([
                prisma.leaveRequest.update({ where: { id: requestId }, data: { status: 'APPROVED' } }),
                prisma.user.update({
                    where: { id: request.userId },
                    data: { leaveBalance: { decrement: days } }
                })
            ]);
        }
        else {
            await prisma.leaveRequest.update({ where: { id: requestId }, data: { status: 'REJECTED' } });
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
        const { inTime, outTime, status } = req.body; // inTime/outTime format "HH:mm"
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const updateData = {};
        if (status)
            updateData.status = status;
        const setTime = (timeStr) => {
            const [h, m] = timeStr.split(':').map(Number);
            const d = new Date(today);
            d.setHours(h, m, 0, 0);
            return d;
        };
        if (inTime && inTime !== '--')
            updateData.inTime = setTime(inTime);
        if (outTime && outTime !== '--')
            updateData.outTime = setTime(outTime);
        await prisma.attendance.upsert({
            where: { userId_date: { userId: Number(traineeId), date: today } },
            update: updateData,
            create: {
                userId: Number(traineeId),
                date: today,
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