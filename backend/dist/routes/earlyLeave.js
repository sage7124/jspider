"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Helper to check if a trainee is assigned to a supervisor
async function isTraineeAssignedToSupervisor(supervisorId, traineeId) {
    const supervisor = await prisma.user.findUnique({
        where: { id: supervisorId },
        include: { trainees: true }
    });
    return supervisor?.trainees.some(t => t.id === traineeId) || false;
}
// GET /api/early-leave - List all permissions
router.get('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role === 'TRAINEE') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        let supervisorFilter = {};
        if (req.user?.role === 'SUPERVISOR') {
            supervisorFilter = {
                user: {
                    supervisors: {
                        some: { id: req.user.id }
                    }
                }
            };
        }
        const permissions = await prisma.earlyLeavePermission.findMany({
            where: supervisorFilter,
            include: {
                user: {
                    select: {
                        fullName: true,
                        identifier: true,
                        department: true
                    }
                }
            },
            orderBy: { date: 'desc' }
        });
        res.json(permissions);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// POST /api/early-leave - Create a new permission
router.post('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role === 'TRAINEE') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const { userId, date, slotNo, allowedMinutes, reason } = req.body;
        if (!userId || !date || slotNo === undefined || !allowedMinutes) {
            return res.status(400).json({ error: 'Missing required fields (userId, date, slotNo, allowedMinutes).' });
        }
        const targetUserId = Number(userId);
        const targetSlotNo = Number(slotNo);
        const targetAllowedMinutes = Number(allowedMinutes);
        if (req.user?.role === 'SUPERVISOR') {
            const isAssigned = await isTraineeAssignedToSupervisor(req.user.id, targetUserId);
            if (!isAssigned) {
                return res.status(403).json({ error: 'Access denied: Trainee is not assigned to you.' });
            }
        }
        // Normalize date to local midnight
        const parsedDate = new Date(date);
        parsedDate.setHours(0, 0, 0, 0);
        const permission = await prisma.earlyLeavePermission.upsert({
            where: {
                userId_date_slotNo: {
                    userId: targetUserId,
                    date: parsedDate,
                    slotNo: targetSlotNo
                }
            },
            update: {
                allowedMinutes: targetAllowedMinutes,
                reason: reason || null
            },
            create: {
                userId: targetUserId,
                date: parsedDate,
                slotNo: targetSlotNo,
                allowedMinutes: targetAllowedMinutes,
                reason: reason || null
            }
        });
        res.status(201).json({ message: 'Early leave permission saved successfully.', permission });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// PUT /api/early-leave/:id - Update an existing permission
router.put('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role === 'TRAINEE') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const id = Number(req.params.id);
        const { userId, date, slotNo, allowedMinutes, reason } = req.body;
        const existingPermission = await prisma.earlyLeavePermission.findUnique({
            where: { id }
        });
        if (!existingPermission) {
            return res.status(404).json({ error: 'Permission record not found.' });
        }
        if (req.user?.role === 'SUPERVISOR') {
            const isAssigned = await isTraineeAssignedToSupervisor(req.user.id, existingPermission.userId);
            if (!isAssigned) {
                return res.status(403).json({ error: 'Access denied: Trainee is not assigned to you.' });
            }
        }
        const targetUserId = Number(userId);
        const targetSlotNo = Number(slotNo);
        const targetAllowedMinutes = Number(allowedMinutes);
        // Normalize date to local midnight
        const parsedDate = new Date(date);
        parsedDate.setHours(0, 0, 0, 0);
        // Check duplicate unique keys
        const duplicate = await prisma.earlyLeavePermission.findFirst({
            where: {
                userId: targetUserId,
                date: parsedDate,
                slotNo: targetSlotNo,
                id: { not: id }
            }
        });
        if (duplicate) {
            return res.status(400).json({ error: 'A permission already exists for this trainee, date, and slot.' });
        }
        const updated = await prisma.earlyLeavePermission.update({
            where: { id },
            data: {
                userId: targetUserId,
                date: parsedDate,
                slotNo: targetSlotNo,
                allowedMinutes: targetAllowedMinutes,
                reason: reason || null
            }
        });
        res.json({ message: 'Early leave permission updated successfully.', permission: updated });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// DELETE /api/early-leave/:id - Delete a permission
router.delete('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        if (req.user?.role === 'TRAINEE') {
            return res.status(403).json({ error: 'Access denied.' });
        }
        const id = Number(req.params.id);
        const permission = await prisma.earlyLeavePermission.findUnique({
            where: { id }
        });
        if (!permission) {
            return res.status(404).json({ error: 'Permission record not found.' });
        }
        if (req.user?.role === 'SUPERVISOR') {
            const isAssigned = await isTraineeAssignedToSupervisor(req.user.id, permission.userId);
            if (!isAssigned) {
                return res.status(403).json({ error: 'Access denied: Trainee is not assigned to you.' });
            }
        }
        await prisma.earlyLeavePermission.delete({
            where: { id }
        });
        res.json({ message: 'Permission deleted successfully.' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
//# sourceMappingURL=earlyLeave.js.map