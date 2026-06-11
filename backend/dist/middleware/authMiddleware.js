"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdminOrSupervisor = exports.requireAdmin = exports.authenticateToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const prisma = new client_1.PrismaClient();
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        req.user = decoded;
        // Check if account is disabled or user has left
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { activeSessionToken: true, isDisabled: true, hasLeft: true }
        });
        if (user) {
            const path = req.path.toLowerCase();
            if (user.hasLeft && !path.startsWith('/profile') && !path.startsWith('/logout')) {
                return res.status(403).json({ error: 'Access Denied: You have left the institute.' });
            }
            if (user.isDisabled && !path.startsWith('/profile') && !path.startsWith('/logout')) {
                return res.status(403).json({ error: 'Access Denied: Account is temporarily disabled.' });
            }
            if (decoded.role === 'TRAINEE') {
                if (user.activeSessionToken && user.activeSessionToken !== token) {
                    return res.status(401).json({
                        error: 'You have been logged in on another device. Please login again.',
                        code: 'SESSION_REPLACED'
                    });
                }
            }
        }
        next();
    }
    catch (err) {
        if (err.name === 'TokenExpiredError') {
            return res.status(401).json({ error: 'Your session has expired. Please log out and log in again.' });
        }
        return res.status(401).json({ error: 'Invalid session token. Please log out and log in again.' });
    }
};
exports.authenticateToken = authenticateToken;
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Admin access required' });
    }
    next();
};
exports.requireAdmin = requireAdmin;
const requireAdminOrSupervisor = (req, res, next) => {
    if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERVISOR') {
        return res.status(403).json({ error: 'Admin or Supervisor access required' });
    }
    next();
};
exports.requireAdminOrSupervisor = requireAdminOrSupervisor;
//# sourceMappingURL=authMiddleware.js.map