import { defineConfig } from '@playwright/test';

// Browser flow tests run against a local `npm run dev` instance (app/), per
// the same "Running locally, use Chrome" pattern established for Agent 6's
// live testing — not against the deployed project directly, since there's
// no separate staging deployment yet.
export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    baseURL: process.env.FOOS_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  webServer: process.env.FOOS_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev --workspace=app -- --port=5173',
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 30000,
        cwd: '..',
      },
});
