export const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  task: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
  },
  subtask: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
  notification: {
    findMany: jest.fn(),
  },
  notificationSettings: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
  pushDevice: {
    deleteMany: jest.fn(),
    upsert: jest.fn(),
  },
};