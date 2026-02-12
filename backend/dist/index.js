"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const swagger_ui_express_1 = __importDefault(require("swagger-ui-express"));
const swagger_1 = require("./swagger");
const auth_1 = __importDefault(require("./routes/auth"));
const tasks_1 = __importDefault(require("./routes/tasks"));
const cors_1 = __importDefault(require("cors"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = Number(process.env.PORT) || 3000;
// Middleware
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Debug: Log what's in the swagger spec
console.log('=== SWAGGER SPEC CHECK ===');
console.log('Swagger paths:', Object.keys(swagger_1.swaggerSpec.paths || {}));
console.log('Total endpoints:', Object.keys(swagger_1.swaggerSpec.paths || {}).length);
// Serve raw Swagger spec as JSON for debugging (BEFORE swagger UI middleware)
app.get('/api/docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.json(swagger_1.swaggerSpec);
});
// Swagger Documentation UI
app.use('/api/docs', swagger_ui_express_1.default.serve);
app.get('/api/docs', swagger_ui_express_1.default.setup(swagger_1.swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Prioritize API Documentation',
    swaggerOptions: {
        persistAuthorization: true,
    },
}));
// API Routes
app.use('/api', auth_1.default);
app.use('/api', tasks_1.default);
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
