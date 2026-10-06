import { defineConfig } from '@playwright/test';
import 'dotenv/config';
import './localTarget';

const PORT = Number(process.env.FOOS_PORT ?? 5175);
const BASE_URL = process.env.FOOS_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',

  workers: Number(process.env.FOOS_PW_WORKERS ?? 4),
  maxFailures: Number(process.env.FOOS_PW_MAX_FAILURES ?? 1),
  reporter: [['line']],
  timeout: 30000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  ...(process.env.FOOS_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: 'npm run dev --workspace=app',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 60000,
          cwd: '..',
        },
      }),
});
