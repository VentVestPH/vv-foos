const { chromium } = require('@playwright/test');
(async () => {
  try {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto('data:text/html,<h1>hi</h1>');
    console.log('TITLE_OK', await page.title());
    await browser.close();
  } catch (e) {
    console.error('LAUNCH_FAILED:', e.message);
    process.exit(1);
  }
})();
