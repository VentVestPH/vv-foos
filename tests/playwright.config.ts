import { defineConfig } from '@playwright/test';
import 'dotenv/config';

const PORT = Number(process.env.FOOS_PORT ?? 5175);
const BASE_URL = process.env.FOOS_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // The local Realtime container enforces a messages-per-second limit, and the
  // app opens a postgres_changes subscription on every page. Three parallel
  // workers exceed it, Realtime silently drops messages, and the live-update
  // tests go stale. Two workers stay under it. Raise only with evidence from
  // `docker logs supabase_realtime_* | grep MessagePerSecondRateLimitReached`.
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
