import { chromium } from 'playwright';

const BASE = 'http://localhost:4178';

const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();

await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('Email').fill('klent@ventvest.com');
await page.getByLabel('Password').fill('local-dev-only-pw');
await page.getByRole('button', { name: /sign in with email/i }).click();
await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15000 });
console.log('Logged in, landed at', page.url());

await context.storageState({ path: '/private/tmp/claude-502/-Users-klentz-Work-VV-FoOS/eb5b788f-8fb6-432b-ba40-74d001481dbd/scratchpad/auth-state.json' });
await browser.close();
console.log('Saved storage state.');
