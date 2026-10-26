// Checks whether the floating Sage button covers anything on member pages, at 390px and 1440px.
// Usage: node scripts/visual/sage_overlap.cjs <before|after> [path ...]   (needs visual_fixtures.cjs up, and npm run dev)
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual_state.json'), 'utf8'));
const BASE = 'http://localhost:3000';
const tag = process.argv[2] || 'before';
const paths = process.argv.slice(3).length ? process.argv.slice(3) : ['/learn', '/dashboard'];
const OUT = path.join(root, 'docs', 'screenshots', 'sage-learn');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch();
  const ctx0 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p0 = await ctx0.newPage();
  await p0.goto(BASE + '/login', { waitUntil: 'load', timeout: 180000 });
  await p0.fill('input[type="email"]', STATE.member.email);
  await p0.fill('input[type="password"]', STATE.member.password);
  await Promise.all([p0.waitForURL((u) => !/login/.test(u.pathname), { timeout: 180000 }).catch(() => {}), p0.click('button[type="submit"]')]);
  await sleep(3000);
  const stateFile = path.join(__dirname, 'pw-member.json');
  await ctx0.storageState({ path: stateFile }); await ctx0.close();
  for (const [name, vp] of [['390', { width: 390, height: 844 }], ['1440', { width: 1440, height: 900 }]]) {
    for (const url of paths) {
      const ctx = await browser.newContext({ viewport: vp, storageState: stateFile });
      const page = await ctx.newPage();
      await page.goto(BASE + url, { waitUntil: 'load', timeout: 180000 });
      await sleep(4500);
      const slug = url.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'home';
      // scroll through the page and, at each stop, see what sits under the orb
      const res = await page.evaluate(async () => {
        const orb = document.querySelector('.sage-orb');
        const root = document.querySelector('.sage-root');
        if (!orb) return { orb: false };
        const hidden = getComputedStyle(root).display === 'none' || getComputedStyle(orb).display === 'none';
        if (hidden) return { orb: true, hidden: true };
        const hits = new Set();
        const total = document.documentElement.scrollHeight;
        // Content passing under a fixed button mid-scroll is normal. What matters: the dock, and the end of the page.
        for (const y of [total]) {
          window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120));
          const r = orb.getBoundingClientRect();
          const els = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          // also sample the four corners of the orb
          for (const [dx, dy] of [[0.15, 0.15], [0.85, 0.15], [0.15, 0.85], [0.85, 0.85], [0.5, 0.5]]) {
            for (const el of document.elementsFromPoint(r.left + r.width * dx, r.top + r.height * dy)) {
              if (el.closest('.sage-root')) continue;
              if (el === document.documentElement || el === document.body) continue;
              const t = (el.innerText || '').trim().slice(0, 40);
              const tag = el.tagName.toLowerCase();
              const interactive = el.closest('a,button,input,select,textarea,[role=button]');
              if (interactive || (t && el.children.length === 0)) { hits.add(`${tag}${interactive ? '*' : ''}:${t}`); break; }
            }
          }
        }
        window.scrollTo(0, 0);
        const r = orb.getBoundingClientRect();
        return { orb: true, hidden: false, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], coveredElements: [...hits].slice(0, 12), bottomPad: getComputedStyle(document.querySelector('main') || document.body).paddingBottom };
      });
      console.log(`${tag} ${url} @${name}:`, JSON.stringify(res));
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await sleep(400);
      await page.screenshot({ path: path.join(OUT, `${tag}-${slug}-${name}-bottom.jpg`), type: 'jpeg', quality: 70 });
      await page.evaluate(() => window.scrollTo(0, 0)); await sleep(300);
      await page.screenshot({ path: path.join(OUT, `${tag}-${slug}-${name}-top.jpg`), type: 'jpeg', quality: 70 });
      await ctx.close();
    }
  }
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
