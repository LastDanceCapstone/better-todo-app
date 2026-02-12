// src/index.ts
import express from 'express';
<<<<<<< HEAD
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import cors from 'cors';
import aiRoutes from './routes/ai';

=======
import cors from 'cors';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import tasksRouter from './routes/tasks';
import { prisma } from './prisma';
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540

dotenv.config();

const app = express();
<<<<<<< HEAD
const PORT = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors());
app.use(express.json());


// Debug: Log what's in the swagger spec
console.log('=== SWAGGER SPEC CHECK ===');
console.log('Swagger paths:', Object.keys((swaggerSpec as any).paths || {}));
console.log('Total endpoints:', Object.keys((swaggerSpec as any).paths || {}).length);

// Serve raw Swagger spec as JSON for debugging (BEFORE swagger UI middleware)
app.get('/api/docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.json(swaggerSpec);
});

// Swagger Documentation UI
app.use('/api/docs', swaggerUi.serve);
app.get('/api/docs', swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Prioritize API Documentation',
  swaggerOptions: {
    persistAuthorization: true,
  },
}));

// API Routes
app.use('/api', authRoutes);
app.use('/api', taskRoutes);

// Ai Routes
app.use('/api', aiRoutes);


// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Prioritize API is running',
    timestamp: new Date().toISOString(),
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Prioritize API is running',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Welcome to Prioritize API',
    version: '1.0.0',
    documentation: '/api/docs',
    rawSpec: '/api/docs.json',
    endpoints: {
      auth: {
        register: 'POST /api/register',
        login: 'POST /api/login',
        profile: 'GET /api/user/profile',
      },
      tasks: {
        getAll: 'GET /api/tasks',
        create: 'POST /api/tasks',
        update: 'PATCH /api/tasks/:id',
        delete: 'DELETE /api/tasks/:id',
      },
      subtasks: {
        create: 'POST /api/tasks/:id/subtasks',
        update: 'PATCH /api/subtasks/:id',
        delete: 'DELETE /api/subtasks/:id',
      },
    },
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  console.log(`Local access: http://localhost:${PORT}`);
  console.log(`Network access: http://100.100.66.131:${PORT}`);
  console.log(`📚 API Documentation: http://100.100.66.131:${PORT}/api/docs`);
=======
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
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
});
