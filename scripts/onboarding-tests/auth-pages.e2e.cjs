// The signed-out auth pages must be light at every width, even when the visitor's system is set to dark, and must not scroll sideways.
//   BASE_URL=http://localhost:3000 npm run test:auth-theme
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright'));
const BASE = process.env.BASE_URL || 'http://localhost:3000';
const SHOTS = process.env.SHOTS_DIR;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

const PAGES = ['/login', '/signup', '/forgot-password', '/login?error=link_expired'];
const lum = (rgb) => { const [r, g, b] = rgb.match(/\d+(\.\d+)?/g).map(Number).slice(0, 3); return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; };

for (const scheme of ['light', 'dark']) {
  for (const width of [390, 768, 1440]) {
    for (const url of PAGES) {
      test(`${url} is light at ${width}px with the system set to ${scheme}`, { timeout: 90000 }, async () => {
        const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
        const page = await ctx.newPage();
        await page.goto(BASE + url, { waitUntil: 'load', timeout: 60000 });
        await page.locator('.ax').first().waitFor({ timeout: 30000 });
        const info = await page.evaluate(() => {
          const ax = document.querySelector('.ax');
          const cs = getComputedStyle(ax);
          const art = document.querySelector('.ax-art');
          const body = document.querySelector('.ax-body');
          return { bg: cs.backgroundColor, color: cs.color, scheme: cs.colorScheme, over: document.documentElement.scrollWidth - innerWidth,
            artBg: art ? getComputedStyle(art).backgroundColor : null, cols: cs.gridTemplateColumns.split(' ').length,
            bodyBottom: body ? body.getBoundingClientRect().bottom : 0 };
        });
        assert.ok(lum(info.bg) > 0.9, `${url}: page background is dark (${info.bg})`);
        assert.ok(lum(info.color) < 0.3, `${url}: text colour is light (${info.color})`);
        assert.ok(info.over <= 1, `${url}: scrolls sideways by ${info.over}px`);
        assert.equal(info.cols, 1, `${url}: still a split layout`);
        if (info.artBg) assert.ok(lum(info.artBg) > 0.9 || info.artBg === 'rgba(0, 0, 0, 0)', `${url}: dark panel (${info.artBg})`);
        if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, `${url.replace(/[^a-z]/g, '') || 'home'}-${width}-${scheme}.png`), fullPage: true }); }
        await ctx.close();
      });
    }
  }
}
