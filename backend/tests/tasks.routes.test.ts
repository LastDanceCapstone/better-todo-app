import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { mockPrisma } from './helpers/mockPrisma';

jest.mock('../src/prisma', () => ({
  prisma: require('./helpers/mockPrisma').mockPrisma,
}));

const createToken = (userId: string, email = 'test@example.com') =>
  jwt.sign({ userId, email }, process.env.JWT_SECRET as string, { expiresIn: '1h' });

const authHeader = (userId: string) => ({ Authorization: `Bearer ${createToken(userId)}` });
const taskId = 'c123456789012345678901234';
const secondTaskId = 'c223456789012345678901234';

const buildTask = (overrides: Record<string, unknown> = {}) => ({
  id: taskId,
  title: 'Write tests',
  description: 'Critical task',
  status: 'TODO',
  priority: 'MEDIUM',
  dueAt: new Date('2026-04-12T15:00:00.000Z'),
  completedAt: null,
  statusChangedAt: null,
  createdAt: new Date('2026-04-11T10:00:00.000Z'),
  updatedAt: new Date('2026-04-11T10:00:00.000Z'),
  userId: 'user-1',
  subtasks: [],
  ...overrides,
});

describe('task routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a task with valid input', async () => {
    const task = buildTask();
    mockPrisma.task.create.mockResolvedValue(task);

    const response = await request(app)
      .post('/api/tasks')
      .set(authHeader('user-1'))
      .send({ title: 'Write tests', priority: 'HIGH' });

    expect(response.status).toBe(201);
    expect(response.body.task.title).toBe('Write tests');
    expect(mockPrisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: 'user-1', title: 'Write tests', priority: 'HIGH' }),
      })
    );
  });

  it('rejects task creation without a title', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set(authHeader('user-1'))
      .send({ priority: 'HIGH' });

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
  });

  it('returns only the authenticated user tasks', async () => {
    mockPrisma.task.findMany.mockResolvedValue([
      buildTask({ id: secondTaskId, userId: 'user-1', title: 'User task' }),
    ]);

    const response = await request(app)
      .get('/api/tasks')
      .set(authHeader('user-1'));

    expect(response.status).toBe(200);
    expect(response.body.tasks).toHaveLength(1);
    expect(response.body.tasks[0].title).toBe('User task');
    expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    );
  });

  it('updates a task with valid input', async () => {
    const updatedTask = buildTask({ title: 'Updated task', status: 'IN_PROGRESS' });
    mockPrisma.task.findFirst
      .mockResolvedValueOnce(buildTask())
      .mockResolvedValueOnce(updatedTask);
    mockPrisma.task.updateMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .patch(`/api/tasks/${taskId}`)
      .set(authHeader('user-1'))
      .send({ title: 'Updated task', status: 'IN_PROGRESS' });

    expect(response.status).toBe(200);
    expect(response.body.task.title).toBe('Updated task');
    expect(response.body.task.status).toBe('IN_PROGRESS');
  });

  it('rejects invalid task updates with 4xx', async () => {
    const response = await request(app)
      .patch('/api/tasks/cm1234567890123456789012')
      .set(authHeader('user-1'))
      .send({ priority: 'INVALID' });

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
  });

  it('deletes a task for its owner', async () => {
    mockPrisma.task.findFirst.mockResolvedValue(buildTask());
    mockPrisma.task.deleteMany.mockResolvedValue({ count: 1 });

    const response = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set(authHeader('user-1'));

    expect(response.status).toBe(200);
    expect(response.body.message).toBe('Task deleted successfully');
  });

  it('does not delete another user\'s task', async () => {
    mockPrisma.task.findFirst.mockResolvedValue(null);

    const response = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set(authHeader('user-1'));

    expect(response.status).toBe(404);
    expect(response.body.error).toBe('Task not found');
  });
});