"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.swaggerSpec = void 0;
const swagger_jsdoc_1 = __importDefault(require("swagger-jsdoc"));
const path_1 = __importDefault(require("path"));
const DEFAULT_RAILWAY_API_URL = 'https://prioritize-production-3835.up.railway.app/api';
const LOCAL_API_URL = 'http://localhost:3000/api';
const resolveApiServerUrl = () => {
    if (process.env.SWAGGER_SERVER_URL) {
        return process.env.SWAGGER_SERVER_URL;
    }
    if (process.env.RAILWAY_PUBLIC_DOMAIN) {
        return `https://${process.env.RAILWAY_PUBLIC_DOMAIN}/api`;
    }
    if (process.env.RAILWAY_STATIC_URL) {
        return `https://${process.env.RAILWAY_STATIC_URL}/api`;
    }
    if (process.env.NODE_ENV === 'production') {
        return DEFAULT_RAILWAY_API_URL;
    }
    return LOCAL_API_URL;
};
const primaryApiServerUrl = resolveApiServerUrl();
const servers = [
    {
        url: primaryApiServerUrl,
        description: primaryApiServerUrl.includes('localhost')
            ? 'Development server'
            : 'Primary deployed server',
    },
    ...(primaryApiServerUrl === LOCAL_API_URL
        ? [{ url: DEFAULT_RAILWAY_API_URL, description: 'Railway production server' }]
        : [{ url: LOCAL_API_URL, description: 'Local development server' }]),
];
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
        servers,
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
                        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], example: 'TODO' },
                        priority: { type: 'string', enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'], example: 'HIGH' },
                        dueAt: { type: 'string', format: 'date-time', nullable: true, example: '2026-02-19T23:59:00.000Z' },
                        completedAt: { type: 'string', format: 'date-time', nullable: true, example: null },
                        statusChangedAt: { type: 'string', format: 'date-time', nullable: true, example: null },
                        userId: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                        subtasks: { type: 'array', items: { $ref: '#/components/schemas/Subtask' } },
                    },
                },
                Subtask: {
                    type: 'object',
                    properties: {
                        id: { type: 'string', example: 'cm123abc456def' },
                        title: { type: 'string', example: 'Review code' },
                        description: { type: 'string', nullable: true, example: 'Check API responses' },
                        status: { type: 'string', enum: ['TODO', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'], example: 'TODO' },
                        completedAt: { type: 'string', format: 'date-time', nullable: true, example: null },
                        taskId: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                    },
                },
                Notification: {
                    type: 'object',
                    required: ['id', 'userId', 'type', 'title', 'message', 'isRead', 'createdAt'],
                    properties: {
                        id: { type: 'string', example: 'cm123notif456def' },
                        userId: { type: 'string', example: 'cm123abc456def' },
                        type: {
                            type: 'string',
                            enum: ['TASK_DUE_SOON', 'TASK_OVERDUE', 'MORNING_OVERVIEW', 'EVENING_REVIEW'],
                            example: 'MORNING_OVERVIEW',
                        },
                        title: { type: 'string', example: 'Good morning, London!' },
                        message: { type: 'string', example: 'You have 4 tasks due today.' },
                        isRead: { type: 'boolean', example: false },
                        createdAt: { type: 'string', format: 'date-time', example: '2026-03-30T08:00:00.000Z' },
                        readAt: {
                            type: 'string',
                            format: 'date-time',
                            nullable: true,
                            example: null,
                        },
                    },
                },
                NotificationCreateRequest: {
                    type: 'object',
                    required: ['type', 'title', 'message'],
                    properties: {
                        type: {
                            type: 'string',
                            enum: ['TASK_DUE_SOON', 'TASK_OVERDUE', 'MORNING_OVERVIEW', 'EVENING_REVIEW'],
                            example: 'TASK_DUE_SOON',
                        },
                        title: { type: 'string', example: 'Task due soon' },
                        message: { type: 'string', example: "Your task 'Sprint Review' is due in 1 hour." },
                    },
                },
                NotificationListResponse: {
                    type: 'object',
                    properties: {
                        notifications: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/Notification' },
                        },
                    },
                    example: {
                        notifications: [
                            {
                                id: 'cm123notif456def',
                                userId: 'cm123abc456def',
                                type: 'MORNING_OVERVIEW',
                                title: 'Good morning, London!',
                                message: 'You have 4 tasks due today.',
                                isRead: false,
                                createdAt: '2026-03-30T08:00:00.000Z',
                                readAt: null,
                            },
                        ],
                    },
                },
                NotificationResponse: {
                    type: 'object',
                    properties: {
                        notification: {
                            $ref: '#/components/schemas/Notification',
                        },
                    },
                },
                TasksCompletedPerDayEntry: {
                    type: 'object',
                    required: ['date', 'count'],
                    properties: {
                        date: { type: 'string', format: 'date', example: '2026-03-25' },
                        count: { type: 'integer', example: 3 },
                    },
                },
                ProductivityTrendEntry: {
                    type: 'object',
                    required: ['date', 'completed', 'created'],
                    properties: {
                        date: { type: 'string', format: 'date', example: '2026-03-25' },
                        completed: { type: 'integer', example: 3 },
                        created: { type: 'integer', example: 4 },
                    },
                },
                TaskCategoryEntry: {
                    type: 'object',
                    required: ['category', 'count', 'completed'],
                    properties: {
                        category: { type: 'string', example: 'Uncategorized' },
                        count: { type: 'integer', example: 10 },
                        completed: { type: 'integer', example: 7 },
                    },
                },
                ProductivityHeatmapEntry: {
                    type: 'object',
                    required: ['day', 'hour', 'count'],
                    properties: {
                        day: { type: 'string', enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], example: 'Mon' },
                        hour: { type: 'integer', minimum: 0, maximum: 23, example: 10 },
                        count: { type: 'integer', example: 4 },
                    },
                },
                ProductivityAnalyticsResponse: {
                    type: 'object',
                    required: [
                        'completion_rate',
                        'tasks_completed_this_week',
                        'most_productive_hour',
                        'tasks_completed_per_day',
                        'productivity_trends',
                        'task_categories',
                        'productivity_heatmap',
                    ],
                    properties: {
                        completion_rate: { type: 'number', format: 'float', example: 0.78 },
                        tasks_completed_this_week: { type: 'integer', example: 23 },
                        most_productive_hour: { type: 'string', example: '10:00' },
                        tasks_completed_per_day: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/TasksCompletedPerDayEntry' },
                        },
                        productivity_trends: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/ProductivityTrendEntry' },
                        },
                        task_categories: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/TaskCategoryEntry' },
                        },
                        productivity_heatmap: {
                            type: 'array',
                            items: { $ref: '#/components/schemas/ProductivityHeatmapEntry' },
                        },
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
                AIError: {
                    type: 'object',
                    required: ['error'],
                    properties: {
                        error: {
                            type: 'object',
                            required: ['code', 'message'],
                            properties: {
                                code: { type: 'string', example: 'BAD_REQUEST' },
                                message: { type: 'string', example: 'Invalid request payload' },
                            },
                        },
                    },
                },
                AIValidationError: {
                    type: 'object',
                    required: ['error', 'issues'],
                    properties: {
                        error: {
                            type: 'object',
                            required: ['code', 'message'],
                            properties: {
                                code: { type: 'string', example: 'PARSER_OUTPUT_VALIDATION_ERROR' },
                                message: { type: 'string', example: 'Parsed task output failed validation' },
                            },
                        },
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
            { name: 'Notifications', description: 'User notification endpoints' },
            { name: 'Analytics', description: 'User productivity analytics endpoints' },
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
