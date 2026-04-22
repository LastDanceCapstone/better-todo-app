import { Router } from 'express';
import multer from 'multer';
import {
  formatParserError,
  ParserConfigError,
  ParserOutputValidationError,
  ProviderRequestError,
  parseTaskText,
} from '../llm/taskParser';
import { transcribeAudio } from '../llm/audioTranscriber';
import { authenticateToken } from '../middleware/auth';
import { aiParseTaskValidation } from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();
const MAX_TRANSCRIBE_FILE_SIZE_BYTES = 10 * 1024 * 1024;

const ACCEPTED_AUDIO_MIME_TYPES = new Set([
  'audio/m4a',
  'audio/x-m4a',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/vnd.wave',
  'audio/webm',
  'audio/ogg',
]);

const ACCEPTED_AUDIO_EXTENSIONS = ['.m4a', '.mp4', '.mp3', '.mpeg', '.wav', '.webm', '.ogg'];

const transcribeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_TRANSCRIBE_FILE_SIZE_BYTES,
  },
});

function hasAcceptedExtension(filename: string): boolean {
  const normalized = filename.toLowerCase();
  return ACCEPTED_AUDIO_EXTENSIONS.some((extension) => normalized.endsWith(extension));
}

function isAcceptedMimeType(mimeType: string, originalName?: string): boolean {
  const normalizedMime = mimeType.trim().toLowerCase();

  if ((normalizedMime === 'application/octet-stream' || normalizedMime === 'binary/octet-stream') && originalName) {
    return hasAcceptedExtension(originalName);
  }

  if (ACCEPTED_AUDIO_MIME_TYPES.has(normalizedMime)) {
    return true;
  }

  if (!normalizedMime.startsWith('audio/')) {
    return false;
  }

  if (normalizedMime.includes('mp4') || normalizedMime.includes('mpeg') || normalizedMime.includes('wav') || normalizedMime.includes('webm') || normalizedMime.includes('ogg') || normalizedMime.includes('m4a')) {
    return true;
  }

  return false;
}

function runTranscribeUpload(req: any, res: any): Promise<boolean> {
  return new Promise((resolve) => {
    transcribeUpload.single('file')(req, res, (error: unknown) => {
      if (!error) {
        resolve(true);
        return;
      }

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          res.status(413).json({
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: 'Audio file exceeds 10MB limit',
            },
          });
          resolve(false);
          return;
        }

        res.status(400).json({
          error: {
            code: 'BAD_REQUEST',
            message: error.message,
          },
        });
        resolve(false);
        return;
      }

      res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Invalid multipart form upload',
        },
      });
      resolve(false);
    });
  });
}



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


router.post('/ai/parse-task', authenticateToken, aiParseTaskValidation, async (req: any, res) => {
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

    const { text, timezone } = req.body;

    const trimmedText = text.trim();
    logger.info('[ai.parse-task] request received');

    const parsed = await parseTaskText(trimmedText, timezone?.trim());

    return res.json(parsed);
  } catch (error: unknown) {
    if (error instanceof ParserConfigError) {
      logger.error('[ai.parse-task] parser config error');
      return res.status(503).json(formatParserError(new ParserConfigError('AI task parser is not configured')));
    }

    if (error instanceof ParserOutputValidationError) {
      logger.warn('[ai.parse-task] output validation failed');
      return res.status(422).json({
        ...formatParserError(error),
        issues: error.issues,
      });
    }

    if (error instanceof ProviderRequestError) {
      logger.error('[ai.parse-task] provider request failed');
      return res.status(502).json(formatParserError(new ProviderRequestError('Failed to parse task with AI provider')));
    }

    logger.error('[ai.parse-task] unexpected error');
    return res.status(500).json(formatParserError(error));
  }
});

/**
 * @swagger
 * /ai/transcribe:
 *   post:
 *     summary: Transcribe uploaded audio into text
 *     tags:
 *       - AI
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - file
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Audio file (m4a, mp4, mp3, wav, webm, ogg)
 *     responses:
 *       200:
 *         description: Transcript text
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/TranscribeResponse'
 *       400:
 *         description: Missing/invalid upload payload
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 *       413:
 *         description: Uploaded file too large
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 *       415:
 *         description: Unsupported audio media type
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 *       502:
 *         description: Transcription provider failed
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 *       503:
 *         description: AI transcription is not configured
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AIError'
 */

router.post('/ai/transcribe', authenticateToken, async (req: any, res) => {
  const uploadReady = await runTranscribeUpload(req, res);
  if (!uploadReady) {
    return;
  }

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

    const file = req.file as Express.Multer.File | undefined;
    if (!file) {
      return res.status(400).json({
        error: {
          code: 'BAD_REQUEST',
          message: 'Audio file is required in field "file"',
        },
      });
    }

    if (!isAcceptedMimeType(file.mimetype || '', file.originalname)) {
      return res.status(415).json({
        error: {
          code: 'UNSUPPORTED_MEDIA_TYPE',
          message: 'Unsupported audio format. Use m4a, mp4, mp3, wav, webm, or ogg.',
        },
      });
    }

    logger.info(`[ai.transcribe] request received mimeType=${file.mimetype || 'unknown'} bytes=${file.size}`);
    const transcript = await transcribeAudio(file.buffer, file.mimetype || 'application/octet-stream');

    return res.json({ text: transcript });
  } catch (error: unknown) {
    if (error instanceof ParserConfigError) {
      logger.error('[ai.transcribe] parser config error');
      return res.status(503).json(formatParserError(new ParserConfigError('AI transcription is not configured')));
    }

    if (error instanceof ProviderRequestError) {
      logger.error('[ai.transcribe] provider request failed');
      return res.status(502).json(formatParserError(new ProviderRequestError('Failed to transcribe audio with AI provider')));
    }

    logger.error('[ai.transcribe] unexpected error');
    return res.status(500).json(formatParserError(error));
  }
});

export default router;