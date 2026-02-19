"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const path_1 = __importDefault(require("path"));
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
                ValidationError: {
                    type: 'object',
                    properties: {
                        error: { type: 'string', example: 'Parsed task output failed validation' },
                        issues: {
                            type: 'array',
                            items: { type: 'string' },
                            example: ['Missing required field: title'],
                        },
                    },
                },
                ParseTaskRequest: {
                    type: 'object',
                    required: ['text'],
                    properties: {
                        text: {
                            type: 'string',
                            example: 'Finish sprint demo, high priority, subtasks: record video, push branch',
                        },
                        timezone: {
                            type: 'string',
                            example: 'America/New_York',
                            description: 'Optional IANA timezone used to resolve relative dates',
                        },
                    },
                },
                ParsedTask: {
                    type: 'object',
                    required: ['title', 'description', 'dueDate', 'priority', 'labels', 'subtasks'],
                    properties: {
                        title: { type: 'string', nullable: true, example: 'Finish sprint demo' },
                        description: { type: 'string', nullable: true, example: null },
                        dueDate: { type: 'string', format: 'date-time', nullable: true, example: '2026-02-20T17:00:00.000Z' },
                        priority: {
                            type: 'string',
                            enum: ['LOW', 'MEDIUM', 'HIGH'],
                            nullable: true,
                            example: 'HIGH',
                        },
                        labels: {
                            type: 'array',
                            nullable: true,
                            items: { type: 'string' },
                            example: ['work', 'sprint'],
                        },
                        subtasks: {
                            type: 'array',
                            nullable: true,
                            items: { type: 'string' },
                            example: ['record video', 'push branch'],
                        },
                    },
                },
            },
        },
        tags: [
            { name: 'Authentication', description: 'User authentication endpoints' },
            { name: 'Tasks', description: 'Task management endpoints' },
            { name: 'Subtasks', description: 'Subtask management endpoints' },
            { name: 'AI', description: 'AI-assisted parsing endpoints' },
        ],
        // NO paths object here - let swagger-jsdoc build from JSDoc comments
    },
    // Enable file scanning to pick up @swagger comments from route files
    apis: [
        path_1.default.join(__dirname, './routes/*.ts'),
        path_1.default.join(__dirname, './routes/*.js'),
        path_1.default.join(__dirname, './index.ts'),
    ],
};
console.log('📁 Swagger scanning files at:', path_1.default.join(__dirname, './routes/*.ts'));
exports.swaggerSpec = (0, swagger_jsdoc_1.default)(options);
