import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

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
  } catch (error) {
    console.error(error);
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

    res.json({ token, user: { id: user.id, role: user.role, fullName: user.fullName } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
