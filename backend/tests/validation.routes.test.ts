import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../src/app';
import { mockPrisma } from './helpers/mockPrisma';

jest.mock('../src/prisma', () => ({
  prisma: require('./helpers/mockPrisma').mockPrisma,
}));

const token = jwt.sign({ userId: 'user-1', email: 'test@example.com' }, process.env.JWT_SECRET as string);

describe('validation safety net', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects malformed json with 400', async () => {
    const response = await request(app)
      .post('/api/register')
      .set('Content-Type', 'application/json')
      .send('{"email":');

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Invalid JSON payload');
  });

  it('rejects invalid task ids with 400', async () => {
    const response = await request(app)
      .patch('/api/tasks/not-a-cuid')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Updated' });

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
  });

  it('rejects invalid enums with 400', async () => {
    const response = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Bad enum', priority: 'NOT_REAL' });

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
  });

  it('rejects unexpected query params with 400', async () => {
    const response = await request(app)
      .get('/api/tasks?includeAll=true')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
  });
});