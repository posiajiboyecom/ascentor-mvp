// Admin sweep: every admin route, screenshotted at the given widths, with a horizontal-overflow check on each.
// Usage: node scripts/visual/admin_sweep.cjs <before|after> <width,width,...>      e.g.  before 390,1440
//        ONLY=slug1,slug2 limits it to named routes.   Needs `visual_fixtures.cjs up` and `npm run dev`.
// Screenshots go to docs/screenshots/admin-mobile/<tag>/<route>-<width>.jpg. Emails and phone numbers on screen are masked
// first, and that folder is git-ignored, because the database behind a local run is real.
const path = require('path'); const fs = require('fs'); const crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual_state.json'), 'utf8'));
const BASE = 'http://localhost:3000';
const tag = process.argv[2] || 'before';
const widths = (process.argv[3] || '390').split(',').map(Number);
const OUT = path.join(root, 'docs', 'screenshots', 'admin-mobile', tag); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Area keys from lib/admin/areas.ts NAV, plus the bespoke sub-screens and the pages outside the console.
const AREAS = ['recs', 'members', 'team', 'mentors', 'circles', 'matching', 'mentorship', 'groups', 'cities', 'meetups', 'categories', 'announcements', 'broadcasts', 'moderation', 'chats', 'pathways', 'knowledge', 'payments', 'plans', 'promos', 'referrals', 'products', 'orders', 'leads', 'registrations', 'donations', 'livestream', 'blog', 'pages', 'newsletter', 'billboards', 'partners', 'careers', 'events', 'analysis', 'intel', 'reports', 'surveys', 'audit', 'platform'];
const ROUTES = [
  ['overview', '/admin'],
  ...AREAS.map((a) => [`c-${a}`, `/admin/c/${a}`]),
  ['c-members-groups', '/admin/c/members/groups'], ['c-members-leaders', '/admin/c/members/leaders'],
  ['c-payments-subscriptions', '/admin/c/payments/subscriptions'], ['c-referrals-credits', '/admin/c/referrals/credits'],
  ...['about', 'announcements', 'billboards', 'blog', 'broadcasts', 'careers', 'categories', 'chats', 'chats/log', 'chats/view', 'circles', 'coaching', 'community', 'community-events', 'community-intel', 'content', 'courses', 'demo', 'elevation-summit/registrations', 'events', 'experts', 'groups', 'human-mentors', 'inbox', 'intel', 'knowledge', 'lesson-videos', 'logs', 'marketing-pages', 'marketing-pages/landing', 'master', 'mentors', 'moderation', 'newsletter', 'partners', 'payments', 'permissions', 'products', 'promo-codes', 'reports', 'shop/leads', 'shop/orders', 'shop/products', 'summit', 'summit-donations', 'summit-payments', 'summit-stream', 'surveys', 'users']
    .map((p) => [`legacy-${p.replace(/\//g, '-')}`, `/admin/${p}`]),
];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;

async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 240000 });
  await page.fill('input[type="email"]', STATE.admin.email);
  await page.fill('input[type="password"]', STATE.admin.password);
  await Promise.all([page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 240000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await sleep(2500);
  const f = path.join(__dirname, 'pw-admin.json');
  await ctx.storageState({ path: f }); await ctx.close();
  return f;
}

const mask = () => {
  const re = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g; const ph = /\+?\d[\d\s-]{8,}\d/g;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { const t = n.nodeValue; if (re.test(t) || ph.test(t)) n.nodeValue = t.replace(re, 'member@example.invalid').replace(ph, '+234 000 000 0000'); re.lastIndex = 0; ph.lastIndex = 0; }
  for (const el of document.querySelectorAll('input')) { if (/@/.test(el.value || '')) el.value = 'member@example.invalid'; }
};

(async () => {
  const browser = await chromium.launch();
  const state = await login(browser);
  const report = [];
  for (const width of widths) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, storageState: state });
    for (const [name, url] of ROUTES) {
      if (only && !only.includes(name)) continue;
      const page = await ctx.newPage();
      const rec = { name, url, width };
      // hard cap per route so one stuck page cannot stall the run
      const cap = setTimeout(() => { page.close().catch(() => {}); }, 150000);
      try {
        const res = await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 90000 });
        rec.status = res ? res.status() : 0;
        await sleep(Number(process.env.WAIT || 2200));
        rec.finalPath = new URL(page.url()).pathname;
        await page.evaluate(mask);
        Object.assign(rec, await page.evaluate(() => {
          const de = document.documentElement; const cw = de.clientWidth;
          const offenders = [];
          for (const el of document.body.querySelectorAll('*')) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.right > cw + 1 && getComputedStyle(el).position !== 'fixed') {
              // ignore anything inside a box that scrolls on its own
              let p = el.parentElement, inside = false;
              while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if ((o === 'auto' || o === 'scroll' || o === 'hidden') && p.getBoundingClientRect().right <= cw + 1) { inside = true; break; } p = p.parentElement; }
              if (!inside) offenders.push(`${el.tagName.toLowerCase()}${el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/)[0] : ''}(${Math.round(r.right)})`);
            }
          }
          return {
            overflow: de.scrollWidth - cw,
            offenders: [...new Set(offenders)].slice(0, 4),
            desktopOnly: !!document.querySelector('.rx-admin-desktop') && cw < 1024,
            // cards squeezed narrower than 190px on a phone are the "one word per line" problem
            narrow: [...document.querySelectorAll('.card, .rx-card, .tblwrap, .drawer')].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.width < 190 && cw <= 480 && getComputedStyle(e).position !== 'fixed'; }).length,
            appError: /Application error|Unhandled Runtime Error|This page couldn.t load|404/i.test((document.body.innerText || '').slice(0, 600)),
            textLen: (document.body.innerText || '').trim().length,
          };
        }));
        const file = `${name}-${width}.jpg`;
        const buf = await page.screenshot({ path: path.join(OUT, file), fullPage: true, type: 'jpeg', quality: 62 });
        rec.file = file; rec.hash = crypto.createHash('md5').update(buf).digest('hex').slice(0, 10);
      } catch (e) { rec.fatal = String(e.message).slice(0, 160); }
      clearTimeout(cap); await page.close().catch(() => {});
      report.push(rec);
      console.log(`${width} ${name.padEnd(34)} ${rec.fatal ? 'FATAL ' + rec.fatal : `status=${rec.status} overflow=${rec.overflow}${rec.desktopOnly ? ' DESKTOP-ONLY' : ''}${rec.narrow ? ' NARROW=' + rec.narrow : ''}${rec.appError ? ' ERRTEXT' : ''}${rec.offenders && rec.offenders.length ? ' ' + rec.offenders.join(',') : ''}`}`);
    }
    await ctx.close();
  }
  const f = path.join(OUT, `report-${widths.join('_')}${only ? '-partial' : ''}.json`);
  fs.writeFileSync(f, JSON.stringify(report, null, 1));
  await browser.close();
  console.log('report ->', path.relative(root, f));
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
