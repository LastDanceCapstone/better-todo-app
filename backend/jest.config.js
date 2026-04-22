module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests'],
  setupFiles: ['<rootDir>/jest.setup.ts'],
  clearMocks: true,
  moduleFileExtensions: ['ts', 'tsx', 'js'],
};