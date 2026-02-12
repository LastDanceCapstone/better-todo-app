import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { parseTaskText, TASK_PARSER_SYSTEM_PROMPT } from '../llm/taskParser';

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
 *             type: object
 *             required:
 *               - text
 *             properties:
 *               text:
 *                 type: string
 *                 example: "Finish sprint demo, high priority, subtasks: record video, push branch"
 *     responses:
 *       200:
 *         description: Parsed task response
 */


router.post('/ai/parse-task', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Field "text" is required' });
    }

    const parsed = await parseTaskText(text);

    return res.json({
      parsed,
      prompt: TASK_PARSER_SYSTEM_PROMPT,
    });
  } catch (error: any) {
    return res.status(500).json({ error: error?.message || 'Internal server error' });
  }
});

export default router;
