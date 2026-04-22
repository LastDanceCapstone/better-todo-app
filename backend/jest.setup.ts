process.env.NODE_ENV = 'test';
process.env.PORT = '3001';
process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id';
process.env.OPENAI_API_KEY = 'test-openai-key';
process.env.RESEND_API_KEY = 'test-resend-key';
process.env.MAIL_FROM = 'test@example.com';

const utilModule = require('util');

global.TextEncoder = utilModule.TextEncoder;
global.TextDecoder = utilModule.TextDecoder;

jest.mock('./src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('./src/jobs/notificationScheduler', () => ({
  initNotificationScheduler: jest.fn(),
}));