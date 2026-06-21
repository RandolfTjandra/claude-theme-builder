import { chromium } from 'playwright';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = 'file://' + path.join(__dirname, 'promo.html');
const FPS = 30;

const browser = await chromium.launch({ channel: 'chrome' });
const ctx = await browser.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.waitForTimeout(300); // let fonts settle

const DURATION = await page.evaluate(() => window.DURATION);
const total = Math.round(FPS * DURATION);
const stage = await page.$('#stage');

console.log(`Rendering ${total} frames @ ${FPS}fps (${DURATION}s)...`);
for (let i = 0; i < total; i++) {
  const t = i / FPS;
  await page.evaluate((t) => window.seek(t), t);
  await stage.screenshot({ path: path.join(__dirname, 'frames', `f${String(i).padStart(4, '0')}.png`) });
  if (i % 30 === 0) process.stdout.write(`  ${i}/${total}\r`);
}
console.log(`\nDone: ${total} frames.`);
await browser.close();
