import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { avatarUploadPresignValidation } from '../middleware/validation';
import {
  buildAvatarObjectKey,
  buildAvatarUrl,
  createAvatarUploadUrl,
  getAvatarUploadConstraints,
  isAllowedAvatarMimeType,
} from '../services/objectStorage';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /uploads/avatar/presign:
 *   post:
 *     tags: [Authentication]
 *     summary: Create a presigned upload URL for a user avatar
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - fileName
 *               - mimeType
 *               - fileSize
 *             properties:
 *               fileName:
 *                 type: string
 *                 example: profile.jpg
 *               mimeType:
 *                 type: string
 *                 example: image/jpeg
 *               fileSize:
 *                 type: integer
 *                 example: 182344
 *     responses:
 *       200:
 *         description: Presigned upload URL created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 uploadUrl:
 *                   type: string
 *                 fileKey:
 *                   type: string
 *                 avatarUrl:
 *                   type: string
 *                 headers:
 *                   type: object
 *                 expiresInSeconds:
 *                   type: integer
 *                 maxFileSizeBytes:
 *                   type: integer
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Upload configuration error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/uploads/avatar/presign', authenticateToken, avatarUploadPresignValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fileName, mimeType, fileSize } = req.body as {
      fileName: string;
      mimeType: string;
      fileSize: number;
    };

    const constraints = getAvatarUploadConstraints();
    if (!isAllowedAvatarMimeType(mimeType)) {
      return res.status(400).json({ error: 'Unsupported avatar image type' });
    }

    if (fileSize > constraints.maxFileSizeBytes) {
      return res.status(400).json({ error: `Avatar images must be ${Math.floor(constraints.maxFileSizeBytes / (1024 * 1024))}MB or smaller` });
    }

    const fileKey = buildAvatarObjectKey(userId, fileName, mimeType);
    const uploadUrl = await createAvatarUploadUrl(fileKey, mimeType);

    return res.json({
      uploadUrl,
      fileKey,
      avatarUrl: buildAvatarUrl(fileKey),
      headers: {
        'Content-Type': mimeType,
      },
      expiresInSeconds: constraints.expiresInSeconds,
      maxFileSizeBytes: constraints.maxFileSizeBytes,
    });
  } catch (error: any) {
    if (error instanceof Error && error.message === 'S3 storage is not configured') {
      return res.status(500).json({ error: 'Avatar uploads are not configured on the server' });
    }

    logger.error('Avatar upload presign failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;