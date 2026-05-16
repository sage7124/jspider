import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_key';
const prisma = new PrismaClient();

export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
    fullName: string;
  };
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;

    // For trainees: check if this token is still the active session
    if (decoded.role === 'TRAINEE') {
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { activeSessionToken: true }
      });

      if (user && user.activeSessionToken && user.activeSessionToken !== token) {
        return res.status(401).json({ 
          error: 'You have been logged in on another device. Please login again.',
          code: 'SESSION_REPLACED'
        });
      }
    }

    next();
  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Your session has expired. Please log out and log in again.' });
    }
    return res.status(401).json({ error: 'Invalid session token. Please log out and log in again.' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

export const requireAdminOrSupervisor = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERVISOR') {
    return res.status(403).json({ error: 'Admin or Supervisor access required' });
  }
  next();
};
