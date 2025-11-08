// src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRouter from './routes/auth';
import tasksRouter from './routes/tasks';
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './swagger';

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000; // Convert to number

// Middleware
app.use(express.json());
app.use(cors({
  origin: '*', // Allow all origins for development
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Add request logging middleware for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log('Headers:', req.headers);
  if (req.body && Object.keys(req.body).length > 0) {
    console.log('Body:', req.body);
  }
  next();
});

// Health check (public route)
app.get('/api/health', (_req, res) => {
  console.log('Health check requested');
  res.json({ status: 'OK', message: 'Server is running' });
});

// Mount routes
app.use('/api', authRouter);
app.use('/api', tasksRouter);

// Swagger API docs
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Start server and bind to all network interfaces
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Available on your network at http://100.100.66.139:${PORT}`);
  console.log(`📚 API docs available at http://100.100.66.139:${PORT}/api/docs`);
});

// shutdown
process.on('SIGINT', async () => {
  console.log('\n👋 Shutting down gracefully...');
  process.exit();
});
