"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/auth.ts
const express_1 = require("express");
const bcrypt_1 = __importDefault(require("bcrypt"));
const crypto_1 = __importDefault(require("crypto"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const google_auth_library_1 = require("google-auth-library");
const prisma_1 = require("../prisma");
const email_1 = require("../utils/email");
const router = (0, express_1.Router)();
const FORGOT_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const FORGOT_PASSWORD_MAX_REQUESTS = 5;
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);
const forgotPasswordIpBuckets = new Map();
const forgotPasswordEmailBuckets = new Map();
const googleClient = new google_auth_library_1.OAuth2Client();
const createSessionToken = (userId, email) => {
    return jsonwebtoken_1.default.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '24h' });
};
const buildAuthResponse = (user, token, message = 'Login successful') => {
    return {
        message,
        token,
        user: {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
        },
    };
};
const pruneExpiredBuckets = (bucketMap, now) => {
    for (const [key, bucket] of bucketMap.entries()) {
        if (bucket.resetAt <= now) {
            bucketMap.delete(key);
        }
    }
};
const consumeRateLimit = (bucketMap, key, now) => {
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
const getClientIp = (req) => {
    const forwardedFor = req.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
        return forwardedFor.split(',')[0].trim();
    }
    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
        return String(forwardedFor[0]);
    }
    return req.ip || req.socket?.remoteAddress || 'unknown';
};
// Auth middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }
    jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
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
router.post('/register', async (req, res) => {
    try {
        const { firstName, lastName, email, password } = req.body;
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email }
        });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        const user = await prisma_1.prisma.user.create({
            data: {
                firstName,
                lastName,
                email,
                password: hashedPassword,
            },
        });
        const token = createSessionToken(user.id, user.email);
        res.status(201).json(buildAuthResponse(user, token, 'User created successfully'));
    }
    catch (error) {
        console.error('Registration error:', error);
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
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await prisma_1.prisma.user.findUnique({
            where: { email }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        if (!user.password) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const isValidPassword = await bcrypt_1.default.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }
        const token = createSessionToken(user.id, user.email);
        res.json(buildAuthResponse(user, token));
    }
    catch (error) {
        console.error('Login error:', error);
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
router.post('/auth/google', async (req, res) => {
    console.log('Google auth route hit');
    try {
        const idToken = typeof req.body?.idToken === 'string' ? req.body.idToken.trim() : '';
        if (!idToken) {
            return res.status(400).json({ error: 'idToken is required' });
        }
        const googleClientId = process.env.GOOGLE_CLIENT_ID;
        if (!googleClientId) {
            console.error('GOOGLE_CLIENT_ID is not configured');
            return res.status(500).json({ error: 'Google authentication is not configured' });
        }
        let payload;
        try {
            const ticket = await googleClient.verifyIdToken({
                idToken,
                audience: googleClientId,
            });
            payload = ticket.getPayload();
        }
        catch (tokenError) {
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
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email },
        });
        let user = existingUser;
        if (existingUser) {
            if (existingUser.googleId !== googleId) {
                user = await prisma_1.prisma.user.update({
                    where: { id: existingUser.id },
                    data: {
                        googleId,
                    },
                });
            }
        }
        else {
            user = await prisma_1.prisma.user.create({
                data: {
                    email,
                    firstName,
                    lastName,
                    authProvider: 'google',
                    googleId,
                    password: null,
                },
            });
        }
        if (!user) {
            return res.status(500).json({ error: 'Failed to authenticate user' });
        }
        const token = createSessionToken(user.id, user.email);
        return res.json(buildAuthResponse(user, token));
    }
    catch (error) {
        console.error('Google auth error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/forgot-password', async (req, res) => {
    try {
        const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
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
        const user = await prisma_1.prisma.user.findUnique({
            where: { email },
        });
        if (user) {
            const resetToken = crypto_1.default.randomBytes(32).toString('hex');
            const tokenHash = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
            const expiresAt = new Date(Date.now() + 1000 * 60 * 30);
            await prisma_1.prisma.user.update({
                where: { id: user.id },
                data: {
                    resetPasswordToken: tokenHash,
                    resetPasswordExpiresAt: expiresAt,
                },
            });
            try {
                await (0, email_1.sendPasswordResetEmail)({
                    to: email,
                    token: resetToken,
                });
            }
            catch (emailError) {
                console.error('Failed to send password reset email:', emailError);
            }
        }
        return res.json(genericResponse);
    }
    catch (error) {
        console.error('Forgot password error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/reset-password', async (req, res) => {
    try {
        const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
        const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
        const tokenHash = token ? crypto_1.default.createHash('sha256').update(token).digest('hex') : '';
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and newPassword are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }
        const user = await prisma_1.prisma.user.findFirst({
            where: {
                resetPasswordToken: tokenHash,
                resetPasswordExpiresAt: {
                    gt: new Date(),
                },
            },
        });
        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetPasswordToken: null,
                resetPasswordExpiresAt: null,
            },
        });
        return res.json({ message: 'Password reset successful' });
    }
    catch (error) {
        console.error('Reset password error:', error);
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
router.get('/user/profile', authenticateToken, async (req, res) => {
    try {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: req.user.userId },
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                authProvider: true,
                createdAt: true,
            },
        });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json({ user });
    }
    catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
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
router.patch('/user/profile', authenticateToken, async (req, res) => {
    try {
        const { firstName, lastName } = req.body;
        const updateData = {};
        if (typeof firstName === 'string') {
            const trimmed = firstName.trim();
            if (trimmed.length === 0 || trimmed.length > 100) {
                return res.status(400).json({ error: 'First name must be between 1 and 100 characters' });
            }
            updateData.firstName = trimmed;
        }
        if (typeof lastName === 'string') {
            const trimmed = lastName.trim();
            if (trimmed.length === 0 || trimmed.length > 100) {
                return res.status(400).json({ error: 'Last name must be between 1 and 100 characters' });
            }
            updateData.lastName = trimmed;
        }
        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({ error: 'No valid fields to update' });
        }
        const user = await prisma_1.prisma.user.update({
            where: { id: req.user.userId },
            data: updateData,
            select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                authProvider: true,
                createdAt: true,
            },
        });
        return res.json({ user });
    }
    catch (error) {
        console.error('Update profile error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
