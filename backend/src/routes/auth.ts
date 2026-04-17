// src/routes/auth.ts
import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import rateLimit from 'express-rate-limit';
import { prisma } from '../prisma';
import { sendEmailVerificationEmail, sendPasswordResetEmail } from '../utils/email';
import { env } from '../config/env';
import { authenticateToken } from '../middleware/auth';
import {
  updateAvatarValidation,
  forgotPasswordValidation,
  googleAuthValidation,
  loginValidation,
  noQueryValidation,
  registerValidation,
  resendVerificationValidation,
  resetPasswordValidation,
  validateResetTokenValidation,
  verifyEmailValidation,
  updateProfileValidation,
} from '../middleware/validation';
import {
  buildAvatarUrl,
  deleteManagedObject,
  isManagedAvatarFileKey,
  parseManagedAvatarFileKey,
  resolveAvatarDisplayUrl,
} from '../services/objectStorage';
import { logger } from '../utils/logger';
import { isValidTimeZone } from '../utils/timezone';

const router = Router();

const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_PASSWORD_MAX_REQUESTS = 5;
const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000;
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const JWT_ISSUER = 'prioritize-api';
const JWT_AUDIENCE = 'prioritize-client';

type AuthResponseUser = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  timezone?: string;
  avatarUrl?: string | null;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const forgotPasswordIpBuckets = new Map<string, RateLimitBucket>();
const forgotPasswordEmailBuckets = new Map<string, RateLimitBucket>();
const verifyEmailIpBuckets = new Map<string, RateLimitBucket>();
const verifyEmailBuckets = new Map<string, RateLimitBucket>();
const resendVerificationEmailBuckets = new Map<string, RateLimitBucket>();
const googleClient = new OAuth2Client();

const googleAudiences = env.GOOGLE_CLIENT_ID
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0);

const buildMobileDeepLink = (path: string, params: Record<string, string>) => {
  const query = new URLSearchParams(params).toString();
  return `prioritize://${path}${query ? `?${query}` : ''}`;
};

const normalizeEmail = (value: unknown): string => {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
};

const normalizeIncomingTimeZone = (value: unknown): string | null => {
  if (value === undefined) return null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!isValidTimeZone(trimmed)) return null;
  return trimmed;
};

const isUserVerified = (user: { isVerified?: boolean | null; emailVerified?: boolean | null }): boolean => {
  if (typeof user.isVerified === 'boolean') {
    return user.isVerified;
  }

  return Boolean(user.emailVerified);
};

const generateVerificationCode = (): string => {
  const code = Math.floor(100000 + Math.random() * 900000);
  return String(code);
};

const ttlToMinutes = (ttlMs: number): number => {
  return Math.max(1, Math.floor(ttlMs / 60000));
};

const hashSecret = (value: string): string => {
  return crypto.createHash('sha256').update(value).digest('hex');
};

const timingSafeEqualHex = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
};

const issueAndStoreEmailVerificationCode = async (userId: string, email: string) => {
  const verificationCode = generateVerificationCode();
  const tokenHash = hashSecret(verificationCode);
  const expiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

  await prisma.user.update({
    where: { id: userId },
    data: {
      emailVerificationToken: tokenHash,
      emailVerificationExpiresAt: expiresAt,
      emailVerificationSentAt: new Date(),
    } as unknown as any,
  });

  const verifyUrl = buildMobileDeepLink('verify-email', {
    email,
    code: verificationCode,
  });

  await sendEmailVerificationEmail({
    to: email,
    code: verificationCode,
    verifyUrl,
    expiresInMinutes: ttlToMinutes(VERIFICATION_CODE_TTL_MS),
  });
};

const authRouteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const sensitiveAuthRouteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again later.' },
});

const createSessionToken = (userId: string, email: string) => {
  return jwt.sign(
    { userId, email },
    env.JWT_SECRET,
    {
      algorithm: 'HS256',
      expiresIn: '24h',
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }
  );
};

const applyAuthCookie = (res: any, token: string) => {
  res.cookie('authToken', token, {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.isProduction,
    maxAge: 24 * 60 * 60 * 1000,
  });
};

const buildAuthResponse = (user: AuthResponseUser, token: string, message = 'Login successful') => {
  return {
    message,
    token,
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      timezone: user.timezone ?? 'UTC',
      avatarUrl: user.avatarUrl ?? null,
    },
  };
};

const pruneExpiredBuckets = (bucketMap: Map<string, RateLimitBucket>, now: number) => {
  for (const [key, bucket] of bucketMap.entries()) {
    if (bucket.resetAt <= now) {
      bucketMap.delete(key);
    }
  }
};

const consumeRateLimit = (bucketMap: Map<string, RateLimitBucket>, key: string, now: number) => {
  const current = bucketMap.get(key);

  if (!current || current.resetAt <= now) {
    const resetAt = now + FORGOT_PASSWORD_WINDOW_MS;
    bucketMap.set(key, { count: 1, resetAt });
    return { allowed: true, retryAfterSeconds: Math.ceil((resetAt - now) / 1000) };
  }

  current.count += 1;
  bucketMap.set(key, current);

  return {
    allowed: current.count <= FORGOT_PASSWORD_MAX_REQUESTS,
    retryAfterSeconds: Math.ceil((current.resetAt - now) / 1000),
  };
};

const getClientIp = (req: any): string => {
  const forwardedFor = req.headers['x-forwarded-for'];

  if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
    return forwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return String(forwardedFor[0]);
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
};



/**
 * @swagger
 * /register:
 *   post:
 *     tags: [Authentication]
 *     summary: Register a new user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *               firstName:
 *                 type: string
 *                 example: John
 *               lastName:
 *                 type: string
 *                 example: Doe
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Bad request
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/register', authRouteLimiter, registerValidation, async (req, res) => {
  try {
    const { firstName, lastName, password } = req.body;
    const email = normalizeEmail(req.body?.email);

    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'User already exists with this email' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        password: hashedPassword,
        emailVerified: false,
      },
    });

    try {
      await issueAndStoreEmailVerificationCode(user.id, user.email);
    } catch (emailError) {
      logger.error('Failed to send verification email after registration');
      return res.status(500).json({ error: 'Unable to send verification email. Please try again.' });
    }

    res.status(202).json({
      message: 'Account created. Verify your email to continue.',
      requiresEmailVerification: true,
      email: user.email,
    });
  } catch (error) {
    logger.error('Registration failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /login:
 *   post:
 *     tags: [Authentication]
 *     summary: Login user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: user@example.com
 *               password:
 *                 type: string
 *                 example: password123
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Invalid credentials
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/login', authRouteLimiter, loginValidation, async (req, res) => {
  try {
    const { password } = req.body;
    const email = normalizeEmail(req.body?.email);

    const user = await prisma.user.findUnique({
      where: { email }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!user.password) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    if (!isUserVerified(user as any)) {
      return res.status(403).json({
        error: 'Please verify your email before signing in.',
        code: 'EMAIL_NOT_VERIFIED',
        email: user.email,
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = createSessionToken(user.id, user.email);
    const authResponse = buildAuthResponse(user, token);
    if (authResponse.user.avatarUrl) {
      try { authResponse.user.avatarUrl = await resolveAvatarDisplayUrl(authResponse.user.avatarUrl); } catch {}
    }
    applyAuthCookie(res, token);
    res.json(authResponse);
  } catch (error) {
    logger.error('Login failed');
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /auth/google:
 *   post:
 *     tags: [Authentication]
 *     summary: Sign in or sign up with Google
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Google ID token from client sign-in flow
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       400:
 *         description: Missing token
 *       401:
 *         description: Invalid token or unverified email
 */
router.post('/auth/google', authRouteLimiter, googleAuthValidation, async (req, res) => {
  try {
    const { idToken } = req.body;

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: googleAudiences,
      });
      payload = ticket.getPayload();
    } catch (tokenError) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }

    if (!payload) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }

    const issuer = payload.iss;
    const exp = payload.exp;
    const nowEpoch = Math.floor(Date.now() / 1000);

    if (!issuer || !GOOGLE_ISSUERS.has(issuer)) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }

    if (!exp || exp <= nowEpoch) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }

    if (!payload.email_verified) {
      return res.status(401).json({ error: 'Google account email is not verified' });
    }

    const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : '';
    const firstName = typeof payload.given_name === 'string' ? payload.given_name : null;
    const lastName = typeof payload.family_name === 'string' ? payload.family_name : null;
    const googleId = typeof payload.sub === 'string' ? payload.sub : '';

    if (!email || !googleId) {
      return res.status(401).json({ error: 'Invalid or expired Google token' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    }) as any;

    let user = existingUser;

    if (existingUser) {
      if (existingUser.googleId !== googleId) {
        user = await prisma.user.update({
          where: { id: existingUser.id },
          data: {
            isVerified: true,
            googleId,
            emailVerified: true,
            emailVerificationToken: null,
            emailVerificationExpiresAt: null,
          },
        } as any);
      }
    } else {
      user = await prisma.user.create({
        data: {
          email,
          firstName,
          lastName,
          isVerified: true,
          authProvider: 'google',
          googleId,
          emailVerified: true,
          password: null,
        },
      } as any);
    }

    if (!user) {
      return res.status(500).json({ error: 'Failed to authenticate user' });
    }

    const token = createSessionToken(user.id, user.email);
    const googleAuthResponse = buildAuthResponse(user, token);
    if (googleAuthResponse.user.avatarUrl) {
      try { googleAuthResponse.user.avatarUrl = await resolveAvatarDisplayUrl(googleAuthResponse.user.avatarUrl); } catch {}
    }
    applyAuthCookie(res, token);
    return res.json(googleAuthResponse);
  } catch (error) {
    logger.error('Google authentication failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/forgot-password', sensitiveAuthRouteLimiter, forgotPasswordValidation, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const now = Date.now();
    const ip = getClientIp(req);

    const genericResponse = {
      message: 'If an account exists, a reset email has been sent.',
    };

    pruneExpiredBuckets(forgotPasswordIpBuckets, now);
    pruneExpiredBuckets(forgotPasswordEmailBuckets, now);

    const ipLimitResult = consumeRateLimit(forgotPasswordIpBuckets, ip, now);
    if (!ipLimitResult.allowed) {
      res.setHeader('Retry-After', String(ipLimitResult.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    if (email) {
      const emailLimitResult = consumeRateLimit(forgotPasswordEmailBuckets, email, now);
      if (!emailLimitResult.allowed) {
        res.setHeader('Retry-After', String(emailLimitResult.retryAfterSeconds));
        return res.status(429).json({ error: 'Too many requests. Please try again later.' });
      }
    }

    if (!email) {
      return res.json(genericResponse);
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (user && user.password) {
      const resetCode = generateVerificationCode();
      const tokenHash = hashSecret(resetCode);
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: tokenHash,
          resetPasswordExpiresAt: expiresAt,
        } as unknown as any,
      });

      try {
        await sendPasswordResetEmail({
          to: email,
          code: resetCode,
          resetUrl: buildMobileDeepLink('reset-password', { token: resetCode, email }),
          expiresInMinutes: ttlToMinutes(RESET_TOKEN_TTL_MS),
        });
      } catch (emailError) {
        logger.error('Failed to send password reset email');
      }
    }

    return res.json(genericResponse);
  } catch (error) {
    logger.error('Forgot password request failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/reset-password', sensitiveAuthRouteLimiter, resetPasswordValidation, async (req, res) => {
  try {
    const token = String(req.body.token || '').trim();
    const newPassword = req.body.newPassword;
    const tokenHash = token ? hashSecret(token) : '';

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordExpiresAt: {
          gt: new Date(),
        },
      } as unknown as any,
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        password: hashedPassword,
        emailVerified: true,
        resetPasswordToken: null,
        resetPasswordExpiresAt: null,
      } as unknown as any,
    });

    return res.json({ message: 'Password reset successful' });
  } catch (error) {
    logger.error('Reset password failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/reset-password/validate', sensitiveAuthRouteLimiter, validateResetTokenValidation, async (req, res) => {
  try {
    const token = String(req.query.token || '').trim();
    const tokenHash = hashSecret(token);

    const user = await prisma.user.findFirst({
      where: {
        resetPasswordToken: tokenHash,
        resetPasswordExpiresAt: {
          gt: new Date(),
        },
      } as unknown as any,
      select: {
        email: true,
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    return res.json({ valid: true, email: user.email });
  } catch (error) {
    logger.error('Reset token validation failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/email-verification/resend', authRouteLimiter, resendVerificationValidation, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const now = Date.now();

    pruneExpiredBuckets(resendVerificationEmailBuckets, now);
    const emailLimitResult = consumeRateLimit(resendVerificationEmailBuckets, email, now);
    if (!emailLimitResult.allowed) {
      res.setHeader('Retry-After', String(emailLimitResult.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        isVerified: true,
        emailVerified: true,
        password: true,
      },
    }) as any;

    if (!user || isUserVerified(user) || !user.password) {
      return res.json({ message: 'If verification is required, a verification code has been sent.' });
    }

    await issueAndStoreEmailVerificationCode(user.id, user.email);
    return res.json({ message: 'Verification code sent' });
  } catch (error) {
    logger.error('Resend verification failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/email-verification/verify', sensitiveAuthRouteLimiter, verifyEmailValidation, async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const code = String(req.body?.code || '').trim();
    const now = Date.now();
    const ip = getClientIp(req);

    pruneExpiredBuckets(verifyEmailIpBuckets, now);
    pruneExpiredBuckets(verifyEmailBuckets, now);

    const ipLimitResult = consumeRateLimit(verifyEmailIpBuckets, ip, now);
    if (!ipLimitResult.allowed) {
      res.setHeader('Retry-After', String(ipLimitResult.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const emailLimitResult = consumeRateLimit(verifyEmailBuckets, email, now);
    if (!emailLimitResult.allowed) {
      res.setHeader('Retry-After', String(emailLimitResult.retryAfterSeconds));
      return res.status(429).json({ error: 'Too many requests. Please try again later.' });
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
        isVerified: true,
        emailVerified: true,
        emailVerificationToken: true,
        emailVerificationExpiresAt: true,
      },
    }) as any;

    if (!user || isUserVerified(user) || !user.emailVerificationToken || !user.emailVerificationExpiresAt) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    if (new Date(user.emailVerificationExpiresAt).getTime() <= Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    const incomingHash = hashSecret(code);
    if (!timingSafeEqualHex(user.emailVerificationToken, incomingHash)) {
      return res.status(400).json({ error: 'Invalid or expired verification code' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      } as any,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatarUrl: true,
      },
    });

    const token = createSessionToken(updatedUser.id, updatedUser.email);
    const authResponse = buildAuthResponse(updatedUser, token, 'Email verified successfully');
    if (authResponse.user.avatarUrl) {
      try { authResponse.user.avatarUrl = await resolveAvatarDisplayUrl(authResponse.user.avatarUrl); } catch {}
    }
    applyAuthCookie(res, token);
    return res.json(authResponse);
  } catch (error) {
    logger.error('Email verification failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /user/profile:
 *   get:
 *     tags: [Authentication]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/user/profile', authenticateToken, noQueryValidation, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        timezone: true,
        isVerified: true,
        emailVerified: true,
        avatarUrl: true,
        authProvider: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let displayAvatarUrl: string | null = user.avatarUrl ?? null;
    if (displayAvatarUrl) {
      try {
        displayAvatarUrl = await resolveAvatarDisplayUrl(displayAvatarUrl);
      } catch {}
    }

    return res.json({ user: { ...user, avatarUrl: displayAvatarUrl } });
  } catch (error) {
    logger.error('Profile fetch failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /user/profile:
 *   patch:
 *     tags: [Authentication]
 *     summary: Update current user profile
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
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
 */
router.patch('/user/profile', authenticateToken, updateProfileValidation, async (req: any, res) => {
  try {
    const { firstName, lastName, timezone } = req.body;

    const updateData: { firstName?: string; lastName?: string; timezone?: string } = {};

    if (firstName !== undefined) {
      updateData.firstName = firstName;
    }

    if (lastName !== undefined) {
      updateData.lastName = lastName;
    }

    if (timezone !== undefined) {
      const normalizedTimeZone = normalizeIncomingTimeZone(timezone);
      if (!normalizedTimeZone) {
        return res.status(400).json({ error: 'timezone must be a valid IANA timezone string' });
      }
      updateData.timezone = normalizedTimeZone;
    }

    const user = await prisma.user.update({
      where: { id: req.user.userId },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        timezone: true,
        isVerified: true,
        emailVerified: true,
        avatarUrl: true,
        authProvider: true,
        createdAt: true,
      },
    });

    let displayAvatarUrl: string | null = user.avatarUrl ?? null;
    if (displayAvatarUrl) {
      try {
        displayAvatarUrl = await resolveAvatarDisplayUrl(displayAvatarUrl);
      } catch {}
    }

    return res.json({ user: { ...user, avatarUrl: displayAvatarUrl } });
  } catch (error) {
    logger.error('Profile update failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/user/profile/avatar', authenticateToken, updateAvatarValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { fileKey } = req.body as { fileKey: string | null };

    if (fileKey !== null && !isManagedAvatarFileKey(fileKey, userId)) {
      return res.status(400).json({ error: 'Invalid avatar file key' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!existingUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    const nextAvatarUrl = fileKey ? buildAvatarUrl(fileKey) : null;
    const previousAvatarKey = existingUser.avatarUrl ? parseManagedAvatarFileKey(existingUser.avatarUrl) : null;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: nextAvatarUrl },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        timezone: true,
        isVerified: true,
        emailVerified: true,
        avatarUrl: true,
        authProvider: true,
        createdAt: true,
      },
    });

    if (previousAvatarKey && previousAvatarKey !== fileKey) {
      try {
        await deleteManagedObject(previousAvatarKey);
      } catch (storageError) {
        logger.warn('Failed to delete previous avatar object');
      }
    }

    let displayAvatarUrl: string | null = user.avatarUrl ?? null;
    if (displayAvatarUrl) {
      try {
        displayAvatarUrl = await resolveAvatarDisplayUrl(displayAvatarUrl);
      } catch {}
    }

    return res.json({ user: { ...user, avatarUrl: displayAvatarUrl } });
  } catch (error) {
    logger.error('Avatar update failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /user/delete:
 *   delete:
 *     tags: [Authentication]
 *     summary: Permanently delete the current user's account and all associated data
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account deleted successfully
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/user/delete', sensitiveAuthRouteLimiter, authenticateToken, noQueryValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch current avatar key before deletion so we can clean up S3.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { avatarUrl: true },
    });

    if (!user) {
      // Already deleted or never existed — treat as success so the client can proceed.
      return res.json({ message: 'Account deleted successfully' });
    }

    // Delete the user. All child records (tasks, subtasks, notifications,
    // notificationSettings, pushDevices, focusSessions) cascade via Prisma schema.
    await prisma.user.delete({ where: { id: userId } });

    // Best-effort S3 avatar cleanup — must happen after DB deletion so a failure
    // here does not leave the user record intact.
    if (user.avatarUrl) {
      const fileKey = parseManagedAvatarFileKey(user.avatarUrl);
      if (fileKey && isManagedAvatarFileKey(fileKey, userId)) {
        try {
          await deleteManagedObject(fileKey);
        } catch {
          logger.warn('Failed to delete avatar object during account deletion');
        }
      }
    }

    return res.json({ message: 'Account deleted successfully' });
  } catch (error) {
    logger.error('Account deletion failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
