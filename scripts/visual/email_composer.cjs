// Drives the Email composer like a person: fills it in, ticks the Summit audience, checks the live count and the preview, then
// leaves WITHOUT saving or sending. Also pokes the public unsubscribe and tracking endpoints with a made-up token.
// Needs `visual_fixtures.cjs up` and `npm run dev`.
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual_state.json'), 'utf8'));
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, storageState: state });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  page.on('dialog', (d) => d.dismiss().catch(() => {})); // never confirm a send
  await page.goto(BASE + '/admin/c/newsletter', { waitUntil: 'load', timeout: 240000 });
  await sleep(3000);
  await page.getByRole('button', { name: 'New campaign' }).click();
  await sleep(1500);
  await page.fill('#em-subject', 'Hello {{first_name}}, a quick Summit note');
  await page.locator('.em-editor').click();
  await page.keyboard.type('Hi {{first_name}}, see you at the Summit.');
  await sleep(1500);
  const countText = async () => (await page.locator('.tag.warn').first().innerText()).replace(/\s+/g, ' ');
  console.log('audience before choosing:', await countText());
  const chips = await page.locator('.em-chip').allInnerTexts();
  console.log('chips:', chips.map((c) => c.replace(/\s+/g, ' ')).join(' | '));
  const summit = page.locator('.em-chip', { hasText: /summit/i }).first();
  if (await summit.count()) {
    await summit.click(); await sleep(3500);
    console.log('chip pressed:', await summit.getAttribute('aria-pressed'), '| after Summit chip:', await countText());
    await page.screenshot({ path: path.join(root, 'docs', 'screenshots', 'email-console', 'composer-summit-1440.jpg'), type: 'jpeg', quality: 60 });
  }
  const frame = page.frameLocator('iframe.em-frame');
  const body = await frame.locator('body').innerText().catch(() => '');
  console.log('preview shows merged name / no raw braces:', /Visual|there/.test(body), !/\{\{/.test(body));
  console.log('send button enabled:', await page.getByRole('button', { name: 'Send now' }).isEnabled());
  console.log('before-you-send notes:', (await page.locator('ul[aria-label="Before you send"] li').allInnerTexts()).join(' || '));
  await page.goto(BASE + '/admin/c/newsletter', { waitUntil: 'load' }); await sleep(2500);
  await page.getByRole('button', { name: 'Untitled' }).first().click().catch(() => {}); await sleep(2500);
  console.log('Resend to unopened button present:', await page.getByRole('button', { name: 'Resend to unopened' }).count());
  console.log('console errors in composer:', errors.length, errors.slice(0, 3));

  for (const url of ['/unsubscribe/preview', '/unsubscribe/not-a-real-token']) {
    const r = await page.goto(BASE + url, { waitUntil: 'load' }); console.log(url, r.status());
  }
  const px = await page.request.get(BASE + '/api/email/o/not-a-real-token'); console.log('open pixel (bad token):', px.status(), px.headers()['content-type']);
  const ck = await page.request.get(BASE + '/api/email/c/not-a-real-token?u=https%3A%2F%2Fevil.example&s=bad', { maxRedirects: 0 }); console.log('click (bad sig):', ck.status(), ck.headers()['location'] || '');
  await browser.close();
})();
