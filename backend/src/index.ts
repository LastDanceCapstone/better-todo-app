// src/index.ts
import express from 'express';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';
import authRoutes from './routes/auth';
import taskRoutes from './routes/tasks';
import cors from 'cors';
import aiRoutes from './routes/ai';


dotenv.config();

const app = express();
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
});
