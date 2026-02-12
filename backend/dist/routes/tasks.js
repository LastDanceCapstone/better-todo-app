"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/tasks.ts
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = require("../prisma");
const router = (0, express_1.Router)();
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
 * /tasks:
 *   get:
 *     tags: [Tasks]
 *     summary: Get all tasks for the current user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/tasks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const tasks = await prisma_1.prisma.task.findMany({
            where: { userId },
            include: { subtasks: true },
            orderBy: { createdAt: 'desc' },
        });
        return res.json({ tasks });
    }
    catch (error) {
        console.error('Tasks error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * @swagger
 * /tasks:
 *   post:
 *     tags: [Tasks]
 *     summary: Create a new task
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Complete project
 *               description:
 *                 type: string
 *                 example: Finish the todo app
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *                 example: HIGH
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, COMPLETED, CANCELLED]
 *                 example: TODO
 *               dueAt:
 *                 type: string
 *                 format: date-time
 *                 example: 2024-12-31T23:59:59Z
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *       401:
 *         description: Unauthorized
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/tasks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { title, description, priority, status, dueAt } = req.body;
        const task = await prisma_1.prisma.task.create({
            data: {
                title,
                description,
                priority: priority || 'MEDIUM',
                dueAt: dueAt ? new Date(dueAt) : null,
                userId,
            },
            include: { subtasks: true },
        });
        return res.status(201).json({ task });
    }
    catch (error) {
        console.error('Create task error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * @swagger
 * /tasks/{id}:
 *   patch:
 *     tags: [Tasks]
 *     summary: Update a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated task
 *               description:
 *                 type: string
 *                 example: Updated description
 *               priority:
 *                 type: string
 *                 enum: [LOW, MEDIUM, HIGH, URGENT]
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, COMPLETED, CANCELLED]
 *               dueAt:
 *                 type: string
 *                 format: date-time
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;
        const { title, description, priority, status, dueAt, completedAt } = req.body;
        const existingTask = await prisma_1.prisma.task.findUnique({
            where: { id },
        });
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (existingTask.userId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to update this task' });
        }
        const updateData = {};
        if (title !== undefined)
            updateData.title = title;
        if (description !== undefined)
            updateData.description = description;
        if (priority !== undefined)
            updateData.priority = priority;
        if (status !== undefined) {
            updateData.status = status;
            updateData.statusChangedAt = new Date();
        }
        if (dueAt !== undefined)
            updateData.dueAt = dueAt ? new Date(dueAt) : null;
        if (completedAt !== undefined)
            updateData.completedAt = completedAt ? new Date(completedAt) : null;
        const task = await prisma_1.prisma.task.update({
            where: { id },
            data: updateData,
            include: { subtasks: true },
        });
        return res.json({ task });
    }
    catch (error) {
        console.error('Update task error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     tags: [Tasks]
 *     summary: Delete a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/tasks/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;
        const existingTask = await prisma_1.prisma.task.findUnique({
            where: { id },
        });
        if (!existingTask) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (existingTask.userId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to delete this task' });
        }
        await prisma_1.prisma.task.delete({
            where: { id },
        });
        return res.json({ message: 'Task deleted successfully' });
    }
    catch (error) {
        console.error('Delete task error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * @swagger
 * /tasks/{id}/subtasks:
 *   post:
 *     tags: [Subtasks]
 *     summary: Create a subtask for a task
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Task ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *             properties:
 *               title:
 *                 type: string
 *                 example: Review code
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, COMPLETED, CANCELLED]
 *                 example: TODO
 *     responses:
 *       201:
 *         description: Subtask created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subtask:
 *                   $ref: '#/components/schemas/Subtask'
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.post('/tasks/:id/subtasks', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;
        const { title, description, status } = req.body;
        const task = await prisma_1.prisma.task.findUnique({
            where: { id },
        });
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        if (task.userId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to add subtasks to this task' });
        }
        const subtask = await prisma_1.prisma.subtask.create({
            data: {
                title,
                description,
                taskId: id,
            },
        });
        return res.status(201).json({ subtask });
    }
    catch (error) {
        console.error('Create subtask error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * @swagger
 * /subtasks/{id}:
 *   patch:
 *     tags: [Subtasks]
 *     summary: Update a subtask
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subtask ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *                 example: Updated subtask
 *               description:
 *                 type: string
 *                 example: Updated description
 *               status:
 *                 type: string
 *                 enum: [TODO, IN_PROGRESS, COMPLETED, CANCELLED]
 *                 example: COMPLETED
 *               completedAt:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Subtask updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 subtask:
 *                   $ref: '#/components/schemas/Subtask'
 *       404:
 *         description: Subtask not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.patch('/subtasks/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;
        const { title, description, status, completedAt } = req.body;
        const existingSubtask = await prisma_1.prisma.subtask.findUnique({
            where: { id },
            include: { task: true },
        });
        if (!existingSubtask) {
            return res.status(404).json({ error: 'Subtask not found' });
        }
        if (existingSubtask.task.userId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to update this subtask' });
        }
        const updateData = {};
        if (title !== undefined)
            updateData.title = title;
        if (description !== undefined)
            updateData.description = description;
        if (status !== undefined)
            updateData.status = status;
        if (completedAt !== undefined)
            updateData.completedAt = completedAt ? new Date(completedAt) : null;
        const subtask = await prisma_1.prisma.subtask.update({
            where: { id },
            data: updateData,
        });
        return res.json({ subtask });
    }
    catch (error) {
        console.error('Update subtask error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
/**
 * @swagger
 * /subtasks/{id}:
 *   delete:
 *     tags: [Subtasks]
 *     summary: Delete a subtask
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Subtask ID
 *     responses:
 *       200:
 *         description: Subtask deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *       404:
 *         description: Subtask not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.delete('/subtasks/:id', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: 'Unauthorized' });
        const { id } = req.params;
        const existingSubtask = await prisma_1.prisma.subtask.findUnique({
            where: { id },
            include: { task: true },
        });
        if (!existingSubtask) {
            return res.status(404).json({ error: 'Subtask not found' });
        }
        if (existingSubtask.task.userId !== userId) {
            return res.status(403).json({ error: 'You do not have permission to delete this subtask' });
        }
        await prisma_1.prisma.subtask.delete({
            where: { id },
        });
        return res.json({ message: 'Subtask deleted successfully' });
    }
    catch (error) {
        console.error('Delete subtask error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
