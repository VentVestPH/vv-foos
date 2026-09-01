import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['api/**/*.test.ts', 'mocks/**/*.test.ts'],
    // Files run one at a time. These suites share one local Supabase stack, and
    // the 10 MB oversized-resume case in careers-security saturates the edge
    // runtime badly enough that concurrent Edge Function calls in other files
    // come back 503. Serial execution costs about two seconds in total.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 20000,
    setupFiles: ['./setup.ts'],
  },
});
