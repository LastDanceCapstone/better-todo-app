// src/routes/tasks.ts
import { Router } from 'express';
import { prisma } from '../prisma';

const router = Router();

// GET /api/tasks
router.get('/tasks', async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const tasks = await prisma.task.findMany({
      where: { userId },
      include: { subtasks: true },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ tasks });
  } catch (error) {
    console.error('Tasks error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/tasks
router.post('/tasks', async (req: any, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const { title, description, priority, dueDate } = req.body;

    const task = await prisma.task.create({
      data: {
        title,
        description,
        priority: priority || 'MEDIUM',
        dueDate: dueDate ? new Date(dueDate) : null,
        userId,
      },
    });

    return res.status(201).json({ task });
  } catch (error) {
    console.error('Create task error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
