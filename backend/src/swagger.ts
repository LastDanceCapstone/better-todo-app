import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Prioritize API',
      version: '1.0.0',
      description: 'A task management API with user authentication, task management, and subtask support',
      contact: {
        name: 'The Last Dance Team',
        email: 'contact@prioritize.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server',
      },
      {
        url: 'http://100.100.66.131:3000/api',
        description: 'Network server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm123abc456def' },
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
            email: { type: 'string', example: 'john.doe@example.com' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm123abc456def' },
            title: { type: 'string', example: 'Complete project' },
            description: { type: 'string', example: 'Finish the todo app' },
            status: { type: 'string', enum: ['ACTIVE', 'COMPLETED'], example: 'ACTIVE' },
            priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH'], example: 'HIGH' },
            dueDate: { type: 'string', format: 'date-time', nullable: true },
            userId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
            subtasks: { type: 'array', items: { $ref: '#/components/schemas/Subtask' } },
          },
        },
        Subtask: {
          type: 'object',
          properties: {
            id: { type: 'string', example: 'cm123abc456def' },
            title: { type: 'string', example: 'Review code' },
            isCompleted: { type: 'boolean', example: false },
            taskId: { type: 'string' },
            createdAt: { type: 'string', format: 'date-time' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Invalid credentials' },
          },
        },
      },
    },
    tags: [
      { name: 'Authentication', description: 'User authentication endpoints' },
      { name: 'Tasks', description: 'Task management endpoints' },
      { name: 'Subtasks', description: 'Subtask management endpoints' },
    ],
    // NO paths object here - let swagger-jsdoc build from JSDoc comments
  },
  // Enable file scanning to pick up @swagger comments from route files
  apis: [
    path.join(__dirname, './routes/*.ts'),
    path.join(__dirname, './routes/*.js'),
    path.join(__dirname, './index.ts'),
  ],
};

console.log('📁 Swagger scanning files at:', path.join(__dirname, './routes/*.ts'));

export const swaggerSpec = swaggerJsdoc(options);