// Walks the admin Email console (Campaigns, Contacts, Templates, Settings, the Composer) at 1440 and 390 and reports console
// errors, failed requests and horizontal overflow. Needs `visual_fixtures.cjs up` and `npm run dev`. Sends nothing.
// Screenshots go to docs/screenshots/email-console/ (git-ignored by the admin-mobile rules is NOT assumed: they are masked here).
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual_state.json'), 'utf8'));
const BASE = 'http://localhost:3000';
const OUT = path.join(root, 'docs', 'screenshots', 'email-console'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mask = () => {
  const re = /[\w.+-]+@[\w-]+(\.[\w-]+)+/g;
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const nodes = [];
  while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) { if (re.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(re, 'person@example.invalid'); re.lastIndex = 0; }
  for (const el of document.querySelectorAll('input,textarea')) { if (/@/.test(el.value || '')) el.value = 'person@example.invalid'; }
};

(async () => {
  const browser = await chromium.launch();
  const lc = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const lp = await lc.newPage();
  await lp.goto(BASE + '/login', { waitUntil: 'load', timeout: 240000 });
  await lp.fill('input[type="email"]', STATE.admin.email);
  await lp.fill('input[type="password"]', STATE.admin.password);
  await Promise.all([lp.waitForURL((u) => !/login/.test(u.pathname), { timeout: 240000 }).catch(() => {}), lp.click('button[type="submit"]')]);
  await sleep(2500);
  const state = await lc.storageState(); await lc.close();

  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: width < 600 ? 844 : 900 }, storageState: state });
    const page = await ctx.newPage();
    const errors = []; const failed = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
    page.on('response', (r) => { if (r.status() >= 400) failed.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 90)}`); });
    await page.goto(BASE + '/admin/c/newsletter', { waitUntil: 'load', timeout: 240000 });
    await sleep(4000);
    const shot = async (name) => { await page.evaluate(mask).catch(() => {}); await page.screenshot({ path: path.join(OUT, `${name}-${width}.jpg`), type: 'jpeg', quality: 70, fullPage: true }); };
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log(width, 'campaigns', 'overflow', await overflow()); await shot('campaigns');
    for (const tab of ['Contacts', 'Templates', 'Settings']) {
      const t = page.getByRole('tab', { name: tab }).or(page.getByRole('button', { name: tab, exact: true })).first();
      if (await t.count()) { await t.click(); await sleep(2500); console.log(width, tab.toLowerCase(), 'overflow', await overflow()); await shot(tab.toLowerCase()); }
      else console.log(width, tab, 'TAB NOT FOUND');
    }
    const back = page.getByRole('tab', { name: 'Campaigns' }).or(page.getByRole('button', { name: 'Campaigns', exact: true })).first();
    if (await back.count()) await back.click();
    await sleep(800);
    const nu = page.getByRole('button', { name: /new (campaign|email)/i }).first();
    if (await nu.count()) { await nu.click(); await sleep(3000); console.log(width, 'composer', 'overflow', await overflow()); await shot('composer'); }
    else console.log(width, 'NEW CAMPAIGN BUTTON NOT FOUND');
    console.log(width, 'console errors:', errors.length, errors.slice(0, 5)); console.log(width, 'failed requests:', failed.length, failed.slice(0, 8));
    await ctx.close();
  }
  await browser.close();
})();
