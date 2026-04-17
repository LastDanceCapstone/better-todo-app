import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../src/app';
import { mockPrisma } from './helpers/mockPrisma';

jest.mock('../src/prisma', () => ({
  prisma: require('./helpers/mockPrisma').mockPrisma,
}));

jest.mock('../src/utils/email', () => ({
  sendEmailVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
}));

describe('auth routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('registers a user and requires email verification', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    mockPrisma.user.create.mockImplementation(async ({ data }: any) => ({
      id: 'cm1234567890123456789012',
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      email: data.email,
      password: data.password,
      emailVerified: false,
    }));

    const response = await request(app)
      .post('/api/register')
      .send({
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
      });

    expect(response.status).toBe(202);
    expect(response.body.requiresEmailVerification).toBe(true);
    expect(response.body.email).toBe('test@example.com');
  });

  it('rejects invalid register payloads with 4xx', async () => {
    const invalidEmail = await request(app)
      .post('/api/register')
      .send({ email: 'bad-email', password: 'password123' });

    const weakPassword = await request(app)
      .post('/api/register')
      .send({ email: 'test@example.com', password: '123' });

    expect(invalidEmail.status).toBe(400);
    expect(weakPassword.status).toBe(400);
    expect(invalidEmail.status).not.toBe(500);
    expect(weakPassword.status).not.toBe(500);
  });

  it('logs in with valid credentials and returns a token', async () => {
    const passwordHash = await bcrypt.hash('password123', 10);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'cm1234567890123456789012',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      password: passwordHash,
      emailVerified: true,
    });

    const response = await request(app)
      .post('/api/login')
      .send({ email: 'test@example.com', password: 'password123' });

    expect(response.status).toBe(200);
    expect(response.body.token).toEqual(expect.any(String));
    expect(response.body.user.email).toBe('test@example.com');
  });

  it('rejects invalid credentials with 401', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const response = await request(app)
      .post('/api/login')
      .send({ email: 'test@example.com', password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(response.body.error).toBe('Invalid email or password');
  });

  it('rejects missing login fields with 4xx instead of 500', async () => {
    const response = await request(app)
      .post('/api/login')
      .send({ email: 'test@example.com' });

    expect(response.status).toBe(400);
    expect(response.status).not.toBe(500);
  });
});