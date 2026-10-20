import { fileURLToPath } from 'node:url';
import { defineWorkspace } from 'vitest/config';

const root = fileURLToPath(new URL('..', import.meta.url));

export default defineWorkspace([
  {
    test: {
      name: 'unit',
      root,
      include: ['unit/**/*.test.ts'],
    },
  },
  {
    test: {
      name: 'integration',
      root,
      include: ['integration/**/*.test.ts'],
      retry: 1,
      testTimeout: 20000,
      hookTimeout: 20000,
      setupFiles: ['support/setup.ts'],
    },
  },
]);
