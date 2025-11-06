import swaggerJSDoc from 'swagger-jsdoc';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Prioritize API',
      version: '1.0.0',
      description: 'A task management API with user authentication',
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
            id: {
              type: 'string',
              description: 'User ID',
            },
            firstName: {
              type: 'string',
              description: 'User first name',
            },
            lastName: {
              type: 'string',
              description: 'User last name',
            },
            email: {
              type: 'string',
              format: 'email',
              description: 'User email address',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Account creation date',
            },
          },
        },
        Task: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Task ID',
            },
            title: {
              type: 'string',
              description: 'Task title',
            },
            description: {
              type: 'string',
              description: 'Task description',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'COMPLETED'],
              description: 'Task status',
            },
            priority: {
              type: 'string',
              enum: ['LOW', 'MEDIUM', 'HIGH'],
              description: 'Task priority',
            },
            dueDate: {
              type: 'string',
              format: 'date-time',
              description: 'Task due date',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Task creation date',
            },
            subtasks: {
              type: 'array',
              items: {
                $ref: '#/components/schemas/Subtask',
              },
            },
          },
        },
        Subtask: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Subtask ID',
            },
            title: {
              type: 'string',
              description: 'Subtask title',
            },
            description: {
              type: 'string',
              description: 'Subtask description',
            },
            isCompleted: {
              type: 'boolean',
              description: 'Subtask completion status',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
              description: 'Subtask creation date',
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Error message',
            },
          },
        },
      },
    },
  },
  apis: ['./src/routes/*.ts'], // Path to the API docs
};

export const swaggerSpec = swaggerJSDoc(options);
