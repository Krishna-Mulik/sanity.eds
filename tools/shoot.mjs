// Screenshot harness. Drives the panel through its real states and writes
// PNGs so the UI can be reviewed visually rather than by DOM assertions.
//   node tools/shoot.mjs [outDir]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL = process.env.SANITY_URL ?? 'http://localhost:5173';
const outDir = process.argv[2] ?? 'shots';
mkdirSync(outDir, { recursive: true });

const SECTIONS = ['summary', 'performance', 'seo', 'social', 'security', 'technical', 'accessibility'];

async function run(label, width, height) {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(URL, { waitUntil: 'networkidle' });
  const sr = () => page.locator('#sanity-panel-host').locator('css=.sk-ball');
  await sr().waitFor({ timeout: 5000 });
  const shot = async (n) => {
    await page.screenshot({ path: join(outDir, `${label}-${n}.png`) });
    console.log('shot:', label, n);
  };

  await shot('1-scanning');
  // The scan is real now (network header fetch, link checks, axe-core), not
  // a fixed timer — wait for the ball to actually leave its scanning state
  // instead of guessing a duration.
  await page.waitForFunction(
    () => {
      const ball = document.getElementById('sanity-panel-host')?.shadowRoot?.querySelector('.sk-ball');
      return ball && !ball.hasAttribute('data-scanning');
    },
    { timeout: 15000 },
  );
  await shot('2-ball');

  // Hover the ball to fan the menu out.
  await page.locator('#sanity-panel-host').locator('css=.sk-ball').hover();
  await page.waitForTimeout(750);
  await shot('3-fan');

  for (let i = 0; i < SECTIONS.length; i++) {
    await page.evaluate((idx) => {
      const root = document.getElementById('sanity-panel-host').shadowRoot;
      const tabs = root.querySelectorAll('.sk-tab');
      if (tabs.length) tabs[idx].click();
      else root.querySelectorAll('.sk-bubble')[idx].click();
    }, i);
    await page.waitForTimeout(650);
    await shot(`${4 + i}-${SECTIONS[i]}`);
  }

  // Scrolled state of the longest section.
  await page.evaluate(() => {
    const root = document.getElementById('sanity-panel-host').shadowRoot;
    root.querySelector('.sk-screen').scrollTop = 400;
  });
  await page.waitForTimeout(350);
  await shot('10-scrolled');

  await browser.close();
  if (errors.length) console.log(`\n[${label}] console errors:\n` + errors.join('\n'));
}

await run('desktop', 1440, 900);
await run('mobile', 390, 844);
console.log('\ndone ->', outDir);
