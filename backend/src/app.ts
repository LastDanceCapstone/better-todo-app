import express from 'express';
import swaggerUi from 'swagger-ui-express';
import cors from 'cors';
import helmet from 'helmet';
import { swaggerSpec } from './swagger';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import aiRoutes from './routes/ai';
import notificationRoutes from './routes/notifications';
import analyticsRoutes from './routes/analytics';
import uploadRoutes from './routes/uploads';
import { env } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';

const app = express();

// Railway terminates TLS/proxy upstream and forwards client IP via X-Forwarded-For.
// Required for express-rate-limit to correctly identify callers in production.
app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) {
      callback(null, true);
      return;
    }

    if (env.CORS_ORIGINS.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error('CORS origin not allowed'));
  },
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));
app.use(express.json());

if (!env.isProduction) {
  logger.info('=== SWAGGER SPEC CHECK ===');
  logger.info(`Swagger paths count: ${Object.keys((swaggerSpec as any).paths || {}).length}`);
  logger.info(`Total endpoints: ${Object.keys((swaggerSpec as any).paths || {}).length}`);
}

if (env.NODE_ENV !== 'test') {
  app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swaggerSpec);
  });

  app.use('/api/docs', swaggerUi.serve);
  app.get('/api/docs', swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Prioritize API Documentation',
    swaggerOptions: {
      persistAuthorization: true,
    },
  }));
}

app.use('/api', authRoutes);
app.use('/api', taskRoutes);
app.use('/api', aiRoutes);
app.use('/api', notificationRoutes);
app.use('/api', analyticsRoutes);
app.use('/api', uploadRoutes);

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
        forgotPassword: 'POST /api/forgot-password',
        validateResetToken: 'GET /api/reset-password/validate?token=...',
        resetPassword: 'POST /api/reset-password',
        resendVerification: 'POST /api/email-verification/resend',
        verifyEmail: 'POST /api/email-verification/verify',
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
      ai: {
        parseTask: 'POST /api/ai/parse-task',
        transcribe: 'POST /api/ai/transcribe',
      },
      notifications: {
        getAll: 'GET /api/notifications',
        create: 'POST /api/notifications',
        markRead: 'PATCH /api/notifications/:id/read',
        registerDevice: 'POST /api/notification-devices/register',
      },
      uploads: {
        presignAvatar: 'POST /api/uploads/avatar/presign',
      },
      analytics: {
        productivity: 'GET /api/analytics/productivity',
        focusSessions: 'POST /api/analytics/focus-sessions',
      },
    },
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;