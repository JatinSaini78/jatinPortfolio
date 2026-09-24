// Renders tools/resume.html to assets/Jatin-Saini-iOS-Resume.pdf with Chrome.
// Usage: npx -y -p playwright-core node tools/export-resume.js
const path = require('path');
const { chromium } = require('playwright-core');
(async () => {
  const root = path.resolve(__dirname, '..');
  const browser = await chromium.launch({ channel: 'chrome' });
  const page = await browser.newPage();
  await page.goto('file://' + path.join(root, 'tools/resume.html'));
  await page.pdf({ path: path.join(root, 'assets/Jatin-Saini-iOS-Resume.pdf'), format: 'A4', printBackground: true, preferCSSPageSize: true });
  await browser.close();
  console.log('assets/Jatin-Saini-iOS-Resume.pdf written');
})();
