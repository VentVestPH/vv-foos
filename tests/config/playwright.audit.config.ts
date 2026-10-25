import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';
import 'dotenv/config';
import '../support/localTarget';

const PORT = Number(process.env.FOOS_PORT ?? 5175);
const BASE_URL = process.env.FOOS_BASE_URL ?? `http://localhost:${PORT}`;

const ARTIFACTS = fileURLToPath(new URL('../../.artifacts', import.meta.url));

export default defineConfig({
  testDir: '../audit',
  outputDir: `${ARTIFACTS}/playwright/audit`,
  workers: Number(process.env.FOOS_AUDIT_WORKERS ?? 1),
  timeout: 600000,
  reporter: 'line',
  use: {
    baseURL: BASE_URL,
    trace: 'off',
    screenshot: 'off',
  },
  ...(process.env.FOOS_SKIP_WEBSERVER
    ? {}
    : {
        webServer: {
          command: 'npm run dev --workspace=app',
          url: BASE_URL,
          reuseExistingServer: true,
          timeout: 60000,
          cwd: '../..',
        },
      }),
});
