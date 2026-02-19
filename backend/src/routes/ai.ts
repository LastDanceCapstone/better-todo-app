import { Router } from 'express';
import jwt from 'jsonwebtoken';
import {
  ParserConfigError,
  ParserOutputValidationError,
  ProviderRequestError,
  parseTaskText,
} from '../llm/taskParser';

const router = Router();

const authenticateToken = (req: any, res: any, next: any) => {
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
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Field \"text\" is required and must be a non-empty string"
 *       422:
 *         description: Parsed output failed schema validation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationError'
 *       502:
 *         description: LLM provider failed to parse request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "Failed to parse task with AI provider"
 *       503:
 *         description: AI provider is not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               error: "AI task parser is not configured"
 */


router.post('/ai/parse-task', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { text, timezone } = req.body ?? {};
    if (typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Field "text" is required and must be a non-empty string' });
    }

    if (timezone !== undefined && (typeof timezone !== 'string' || timezone.trim().length === 0)) {
      return res.status(400).json({ error: 'Field "timezone" must be a non-empty string when provided' });
    }

    const trimmedText = text.trim();
    const preview = trimmedText.slice(0, 80);
    console.info(`[ai.parse-task] user=${userId} textLength=${trimmedText.length} preview="${preview}${trimmedText.length > 80 ? '…' : ''}"`);

    const parsed = await parseTaskText(trimmedText, timezone?.trim());

    return res.json(parsed);
  } catch (error: unknown) {
    if (error instanceof ParserConfigError) {
      console.error('[ai.parse-task] parser config error');
      return res.status(503).json({ error: 'AI task parser is not configured' });
    }

    if (error instanceof ParserOutputValidationError) {
      console.warn('[ai.parse-task] output validation failed', { issues: error.issues });
      return res.status(422).json({ error: 'Parsed task output failed validation', issues: error.issues });
    }

    if (error instanceof ProviderRequestError) {
      console.error('[ai.parse-task] provider request failed');
      return res.status(502).json({ error: 'Failed to parse task with AI provider' });
    }

    console.error('[ai.parse-task] unexpected error', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;