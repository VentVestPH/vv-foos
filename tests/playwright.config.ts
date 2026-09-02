import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const PORT = Number(process.env.FOOS_PORT ?? 5175);
const BASE_URL = process.env.FOOS_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',

  workers: Number(process.env.FOOS_PW_WORKERS ?? 2),
  timeout: 30000,
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
  },
  webServer: process.env.FOOS_SKIP_WEBSERVER
    ? undefined
    : {
        command: 'npm run dev --workspace=app',
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 60000,
        cwd: '..',
      },
});
