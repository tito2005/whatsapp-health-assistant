import { logger } from '@/shared/logger';

// Suppress logger output during tests
jest.spyOn(logger, 'info').mockImplementation(() => {});
jest.spyOn(logger, 'warn').mockImplementation(() => {});
jest.spyOn(logger, 'error').mockImplementation(() => {});
jest.spyOn(logger, 'debug').mockImplementation(() => {});

// Global test timeout
jest.setTimeout(30000);

// Setup test environment
beforeAll(async () => {
  // Setup test database, Redis, etc.
});

afterAll(async () => {
  // Cleanup test resources
});