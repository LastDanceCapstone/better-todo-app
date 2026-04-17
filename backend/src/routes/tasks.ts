// src/routes/tasks.ts
import { Router } from 'express';
import { prisma } from '../prisma';
import { authenticateToken } from '../middleware/auth';
import {
  createSubtaskValidation,
  createTaskValidation,
  noQueryValidation,
  subtaskIdParamValidation,
  taskIdParamValidation,
  updateSubtaskValidation,
  updateTaskValidation,
} from '../middleware/validation';
import { logger } from '../utils/logger';

const router = Router();

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const toLocalDefaultEndOfDayIso = (dateOnly: string): string => {
  const [year, month, day] = dateOnly.split('-').map(Number);
  const localDate = new Date(year, month - 1, day, 23, 59, 0, 0);
  return localDate.toISOString();
};

const parseDueAtInput = (value: unknown): { valid: true; value: Date | null } | { valid: false; message: string } => {
  if (value === undefined) {
    return { valid: true, value: null };
  }

  if (value === null) {
    return { valid: true, value: null };
  }

  if (typeof value !== 'string' || value.trim().length === 0) {
    return { valid: false, message: 'Field "dueAt" must be a valid ISO date-time string or null' };
  }

  const trimmed = value.trim();
  const normalized = DATE_ONLY_PATTERN.test(trimmed)
    ? toLocalDefaultEndOfDayIso(trimmed)
    : trimmed;

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return { valid: false, message: 'Field "dueAt" must be a valid ISO date-time string or null' };
  }

  return { valid: true, value: parsed };
};

const serializeTask = (task: any) => ({
  ...task,
  dueAt: task.dueAt ? task.dueAt.toISOString() : null,
  completedAt: task.completedAt ? task.completedAt.toISOString() : null,
  statusChangedAt: task.statusChangedAt ? task.statusChangedAt.toISOString() : null,
  createdAt: task.createdAt ? task.createdAt.toISOString() : null,
  updatedAt: task.updatedAt ? task.updatedAt.toISOString() : null,
  subtasks: Array.isArray(task.subtasks)
    ? task.subtasks.map((subtask: any) => ({
        ...subtask,
        completedAt: subtask.completedAt ? subtask.completedAt.toISOString() : null,
        createdAt: subtask.createdAt ? subtask.createdAt.toISOString() : null,
        updatedAt: subtask.updatedAt ? subtask.updatedAt.toISOString() : null,
      }))
    : task.subtasks,
});

const serializeSubtask = (subtask: any) => ({
  ...subtask,
  completedAt: subtask.completedAt ? subtask.completedAt.toISOString() : null,
  createdAt: subtask.createdAt ? subtask.createdAt.toISOString() : null,
  updatedAt: subtask.updatedAt ? subtask.updatedAt.toISOString() : null,
});

const recomputeParentTaskStatusFromSubtasks = async (taskId: string, userId: string) => {
  const parentTask = await prisma.task.findFirst({
    where: { id: taskId, userId },
    select: { id: true },
  });

  if (!parentTask) {
    return null;
  }

  const subtasks = await prisma.subtask.findMany({
    where: { taskId: parentTask.id },
    select: { status: true },
  });

  if (subtasks.length === 0) {
    return prisma.task.findFirst({
      where: { id: parentTask.id, userId },
      include: { subtasks: true },
    });
  }

  const allCompleted = subtasks.every((subtask) => subtask.status === 'COMPLETED');
  const anyInProgress = subtasks.some((subtask) => subtask.status === 'IN_PROGRESS');

  const nextStatus = allCompleted
    ? 'COMPLETED'
    : anyInProgress
      ? 'IN_PROGRESS'
      : 'TODO';

  await prisma.task.updateMany({
    where: { id: parentTask.id, userId },
    data: {
      status: nextStatus,
      statusChangedAt: new Date(),
      completedAt: allCompleted ? new Date() : null,
    },
  });

  return prisma.task.findFirst({
    where: { id: parentTask.id, userId },
    include: { subtasks: true },
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
router.get('/tasks', authenticateToken, noQueryValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tasks = await prisma.task.findMany({
      where: { userId },
      include: { subtasks: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ tasks: tasks.map(serializeTask) });
  } catch (error) {
    logger.error('Task list retrieval failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     tags: [Tasks]
 *     summary: Get one task for the current user
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
 *         description: Task retrieved successfully
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
router.get('/tasks/:id', authenticateToken, taskIdParamValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const task = await prisma.task.findFirst({
      where: { id, userId },
      include: { subtasks: true },
    });

    if (!task) {
      // Return 404 for both missing and non-owned tasks to avoid ownership leakage.
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json({ task: serializeTask(task) });
  } catch (error) {
    logger.error('Task detail retrieval failed');
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
 *                 example: 2026-02-19T23:59:00.000Z
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
router.post('/tasks', authenticateToken, createTaskValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { title, description, priority, status, dueAt } = req.body;

    if (typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Field "title" is required and must be a non-empty string' });
    }

    const parsedDueAt = parseDueAtInput(dueAt);
    if (!parsedDueAt.valid) {
      return res.status(400).json({ error: parsedDueAt.message });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description,
        priority: priority || 'MEDIUM',
        dueAt: parsedDueAt.value,
        userId,
      },
      include: { subtasks: true },
    });

    return res.status(201).json({ task: serializeTask(task) });
  } catch (error) {
    logger.error('Task creation failed');
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
router.patch('/tasks/:id', authenticateToken, updateTaskValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { title, description, priority, status, dueAt, completedAt } = req.body;

    const existingTask = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (priority !== undefined) updateData.priority = priority;
    if (status !== undefined) {
      updateData.status = status;
      updateData.statusChangedAt = new Date();
    }
    if (dueAt !== undefined) {
      const parsedDueAt = parseDueAtInput(dueAt);
      if (!parsedDueAt.valid) {
        return res.status(400).json({ error: parsedDueAt.message });
      }
      updateData.dueAt = parsedDueAt.value;
    }
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;

    await prisma.task.updateMany({
      where: { id, userId },
      data: updateData,
    });

    const task = await prisma.task.findFirst({
      where: { id, userId },
      include: { subtasks: true },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    return res.json({ task: serializeTask(task) });
  } catch (error) {
    logger.error('Task update failed');
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
router.delete('/tasks/:id', authenticateToken, taskIdParamValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const existingTask = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!existingTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    await prisma.task.deleteMany({
      where: { id, userId },
    });

    return res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    logger.error('Task deletion failed');
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
router.post('/tasks/:id/subtasks', authenticateToken, createSubtaskValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { title, description, status } = req.body;

    const task = await prisma.task.findFirst({
      where: { id, userId },
    });

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const subtask = await prisma.subtask.create({
      data: {
        title: title.trim(),
        description,
        status: status || 'TODO',
        taskId: id,
      },
    });

    await recomputeParentTaskStatusFromSubtasks(id, userId);

    return res.status(201).json({ subtask: serializeSubtask(subtask) });
  } catch (error) {
    logger.error('Subtask creation failed');
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
router.patch('/subtasks/:id', authenticateToken, updateSubtaskValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;
    const { title, description, status, completedAt } = req.body;

    const existingSubtask = await prisma.subtask.findFirst({
      where: {
        id,
        task: {
          userId,
        },
      },
      include: { task: true },
    });

    if (!existingSubtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (completedAt !== undefined) updateData.completedAt = completedAt ? new Date(completedAt) : null;

    const subtask = await prisma.subtask.update({
      where: { id },
      data: updateData,
    });

    const updatedTask = await recomputeParentTaskStatusFromSubtasks(existingSubtask.taskId, userId);

    return res.json({
      subtask: serializeSubtask(subtask),
      task: updatedTask ? serializeTask(updatedTask) : null,
    });
  } catch (error) {
    logger.error('Subtask update failed');
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
router.delete('/subtasks/:id', authenticateToken, subtaskIdParamValidation, async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.params;

    const existingSubtask = await prisma.subtask.findFirst({
      where: {
        id,
        task: {
          userId,
        },
      },
      include: { task: true },
    });

    if (!existingSubtask) {
      return res.status(404).json({ error: 'Subtask not found' });
    }

    await prisma.subtask.delete({
      where: { id },
    });

    await recomputeParentTaskStatusFromSubtasks(existingSubtask.taskId, userId);

    return res.json({ message: 'Subtask deleted successfully' });
  } catch (error) {
    logger.error('Subtask deletion failed');
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
