import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3000';
const OUT = path.join(__dirname, 'current-ui');

const pages = [
  { name: 'dashboard', path: '/' },
  { name: 'nutrition', path: '/nutrition' },
  { name: 'workouts', path: '/workouts' },
  { name: 'reports', path: '/reports' },
];

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

async function run() {
  const browser = await chromium.launch();
  for (const vp of viewports) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    for (const p of pages) {
      await page.goto(`${BASE}${p.path}`, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(3000); // extra time for charts to render
      const filename = path.join(OUT, `${p.name}-${vp.name}.png`);
      await page.screenshot({ path: filename, fullPage: true });
      console.log(`✓ ${p.name}-${vp.name}.png`);
    }
    await context.close();
  }
  await browser.close();
  console.log('Done!');
}
run();
