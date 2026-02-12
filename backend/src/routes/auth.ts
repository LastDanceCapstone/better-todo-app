// src/routes/auth.ts
import { Router } from 'express';
<<<<<<< HEAD
import bcrypt from 'bcrypt';
=======
import bcrypt from 'bcryptjs';
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';

const router = Router();
<<<<<<< HEAD

// Auth middleware
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
=======
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-this';

// POST /api/register
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
router.post('/register', async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

<<<<<<< HEAD
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

=======
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
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
      },
    });

    const token = jwt.sign(
      { userId: user.id, email: user.email },
<<<<<<< HEAD
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.status(201).json({
=======
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
      message: 'User created successfully',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Registration error:', error);
<<<<<<< HEAD
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
=======
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/login
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
<<<<<<< HEAD
      where: { email }
    });

=======
      where: { email },
    });
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

<<<<<<< HEAD
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
=======
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
<<<<<<< HEAD
      process.env.JWT_SECRET!,
      { expiresIn: '24h' }
    );

    res.json({
=======
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
<<<<<<< HEAD
    res.status(500).json({ error: 'Internal server error' });
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
router.get('/user/profile', authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
=======
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/user/profile
router.get('/user/profile', async (req: any, res) => {
  try {
    // we'll rely on auth middleware in index.ts to attach req.user
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        createdAt: true,
      },
    });

<<<<<<< HEAD
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
=======
    if (!user) return res.status(404).json({ error: 'User not found' });

    return res.json({ user });
  } catch (error) {
    console.error('Profile error:', error);
    return res.status(500).json({ error: 'Internal server error' });
>>>>>>> 453bb7ee536ad151fc616cb05397322be4ce0540
  }
});

export default router;
