"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const taskParser_1 = require("../llm/taskParser");
const router = (0, express_1.Router)();
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({
            error: {
                code: 'UNAUTHORIZED',
                message: 'Access token required',
            },
        });
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({
                error: {
                    code: 'FORBIDDEN',
                    message: 'Invalid or expired token',
                },
            });
        }
        req.user = user;
        next();
    });
};
/**
 * @swagger
 * /ai/parse-task:
 *   post:
 *     summary: Parse natural language into structured task data
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ParseTaskRequest'
 *           example:
 *             text: "Finish sprint demo, high priority, subtasks: record video, push branch"
 *             timezone: "America/New_York"
 *     responses:
 *       200:
 *         description: Parsed task response
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ParsedTask'
 *       400:
 *         description: Invalid request payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 *             example:
 *               error:
 *                 code: "BAD_REQUEST"
 *                 message: "Field \"text\" is required and must be a non-empty string"
 *       422:
 *         description: Parsed output failed schema validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIValidationError'
 *       502:
 *         description: LLM provider failed to parse request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 *             example:
 *               error:
 *                 code: "PROVIDER_REQUEST_ERROR"
 *                 message: "Failed to parse task with AI provider"
 *       503:
 *         description: AI provider is not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 *             example:
 *               error:
 *                 code: "PARSER_CONFIG_ERROR"
 *                 message: "AI task parser is not configured"
 */
router.post('/ai/parse-task', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId) {
            return res.status(401).json({
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'Unauthorized',
                },
            });
        }
        const { text, timezone } = req.body ?? {};
        if (typeof text !== 'string' || text.trim().length === 0) {
            return res.status(400).json({
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Field "text" is required and must be a non-empty string',
                },
            });
        }
        if (timezone !== undefined && (typeof timezone !== 'string' || timezone.trim().length === 0)) {
            return res.status(400).json({
                error: {
                    code: 'BAD_REQUEST',
                    message: 'Field "timezone" must be a non-empty string when provided',
                },
            });
        }
        const trimmedText = text.trim();
        const preview = trimmedText.slice(0, 80);
        console.info(`[ai.parse-task] user=${userId} textLength=${trimmedText.length} preview="${preview}${trimmedText.length > 80 ? '…' : ''}"`);
        const parsed = await (0, taskParser_1.parseTaskText)(trimmedText, timezone?.trim());
        return res.json(parsed);
    }
    catch (error) {
        if (error instanceof taskParser_1.ParserConfigError) {
            console.error('[ai.parse-task] parser config error');
            return res.status(503).json((0, taskParser_1.formatParserError)(new taskParser_1.ParserConfigError('AI task parser is not configured')));
        }
        if (error instanceof taskParser_1.ParserOutputValidationError) {
            console.warn('[ai.parse-task] output validation failed', { issues: error.issues });
            return res.status(422).json({
                ...(0, taskParser_1.formatParserError)(error),
                issues: error.issues,
            });
        }
        if (error instanceof taskParser_1.ProviderRequestError) {
            console.error('[ai.parse-task] provider request failed');
            return res.status(502).json((0, taskParser_1.formatParserError)(new taskParser_1.ProviderRequestError('Failed to parse task with AI provider')));
        }
        console.error('[ai.parse-task] unexpected error', error);
        return res.status(500).json((0, taskParser_1.formatParserError)(error));
    }
});
exports.default = router;
