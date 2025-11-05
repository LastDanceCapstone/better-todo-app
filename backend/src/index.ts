// src/index.ts
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import tasksRouter from './routes/tasks';
import { prisma } from './prisma';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// middleware
app.use(express.json());
app.use(cors());

// auth middleware (attach user to req)
const authenticateToken = (req: any, res: any, next: any) => {
  // allow public routes before auth
  if (req.path === '/api/login' || req.path === '/api/register' || req.path === '/api/health') {
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, user: any) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

app.use(authenticateToken);

// health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', message: 'Server is running' });
});

// mount routes
app.use('/api', authRouter);
app.use('/api', tasksRouter);

// start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

// graceful shutdown
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit();
});
