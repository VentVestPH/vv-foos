import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['api/**/*.test.ts', 'mocks/**/*.test.ts'],
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ['./setup.ts'],
  },
});
