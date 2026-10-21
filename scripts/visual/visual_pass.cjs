// Visual pass: screenshots + health checks for every new or changed screen at desktop (1440x900) and mobile (390x844).
// Usage: node visual_pass.cjs [group ...]   groups: public member plan admin   (default: all)
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const OUT = path.join(root, 'docs', 'screenshots');
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual_state.json'), 'utf8'));
const BASE = 'http://localhost:3000';
const SIZES = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844 } };
const groups = process.argv.slice(2).length ? process.argv.slice(2) : ['public', 'member', 'plan', 'admin'];
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const report = [];
const productId = (slug) => STATE.products.find((p) => p.slug === slug)?.id;
const CART = JSON.stringify([{ productId: productId('zz-hoodie'), size: 'M', qty: 1 }, { productId: productId('zz-workbook'), size: null, qty: 1 }]);

async function login(browser, who, urlPath) {
  const ctx = await browser.newContext({ viewport: SIZES.desktop });
  const page = await ctx.newPage();
  await page.goto(BASE + urlPath, { waitUntil: 'load', timeout: 120000 });
  await page.fill('input[type="email"]', STATE[who].email);
  await page.fill('input[type="password"]', STATE[who].password);
  await Promise.all([page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 120000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await sleep(2500);
  const stateFile = path.join(__dirname, `pw-${who}.json`);
  await ctx.storageState({ path: stateFile });
  const where = new URL(page.url()).pathname;
  await ctx.close();
  return { stateFile, where };
}

async function shot(browser, { name, url, auth, cart, act, plan }, sizeName) {
  if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return;
  const ctx = await browser.newContext({ viewport: SIZES[sizeName], ...(auth ? { storageState: auth } : {}) });
  if (cart) await ctx.addInitScript((c) => { try { localStorage.setItem('ascentor.shop.cart.v1', c); } catch {} }, CART);
  const page = await ctx.newPage();
  const errors = []; const bad = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 160)); });
  page.on('pageerror', (e) => errors.push('pageerror: ' + String(e.message).slice(0, 160)));
  page.on('response', (r) => { const s = r.status(); const u = r.url(); if (s >= 400 && u.startsWith(BASE) && !/favicon|\/_next\/static\/.*\.map|api\/health/.test(u)) bad.push(`${s} ${new URL(u).pathname}`); });
  let status = 0; let finalPath = '';
  try {
    const res = await page.goto(BASE + url, { waitUntil: 'load', timeout: 150000 });
    status = res ? res.status() : 0;
    await sleep(Number(process.env.WAIT || 1800));
    if (act) await act(page);
    await sleep(600);
    finalPath = new URL(page.url()).pathname + new URL(page.url()).search;
    const info = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      overlay: !!(document.querySelector('nextjs-portal') && document.querySelector('nextjs-portal').shadowRoot && document.querySelector('nextjs-portal').shadowRoot.querySelector('[data-nextjs-dialog], [data-nextjs-toast-errors]')),
      appError: /Application error|Unhandled Runtime Error|This page couldn.t load/i.test(document.body.innerText || ''),
      placeholder: /\[PRICE\]|\[RETURNS POLICY\]|\[VENUE|\[STREET/.test(document.body.innerText || ''),
      textLen: (document.body.innerText || '').trim().length,
    }));
    const file = `${name}-${sizeName}.jpg`;
    await page.screenshot({ path: path.join(OUT, file), fullPage: true, type: 'jpeg', quality: 62 });
    report.push({ name, size: sizeName, url, finalPath, status, ...info, errors: [...new Set(errors)].slice(0, 3), bad: [...new Set(bad)].slice(0, 3), file });
  } catch (e) {
    report.push({ name, size: sizeName, url, status, fatal: String(e.message).slice(0, 200), errors: [...new Set(errors)].slice(0, 2) });
  }
  await ctx.close();
}

const S = (name, url, o = {}) => ({ name, url, ...o });
(async () => {
  const browser = await chromium.launch();
  const plans = [];
  if (groups.includes('public')) {
    const pub = [
      S('shop-catalogue', '/shop'), S('shop-product-hoodie', '/shop/zz-hoodie'), S('shop-product-soldout', '/shop/zz-cap'),
      S('shop-product-free-leadform', '/shop/zz-free-guide'), S('shop-cart', '/shop/cart', { cart: true }), S('shop-thanks', '/shop/thanks?paid=1'),
      S('signin', '/login'), S('forgot-password', '/forgot-password'),
      S('forgot-password-check-email', '/forgot-password', { act: async (p) => { await p.fill('input[type="email"]', 'someone@example.com'); await p.click('button[type="submit"]'); await sleep(4000); } }),
      S('reset-password', '/reset-password?email=someone%40example.com&code=000000'),
      S('reset-link-expired', '/reset-password?email=someone%40example.com&code=000000', { act: async (p) => { const f = await p.$$('input[type="password"]'); if (f.length) { for (const i of f) await i.fill('Zq7!tRv-9mLp-Ascent1'); await p.click('button[type="submit"]'); await sleep(5000); } } }),
      S('signup', '/signup'), S('signup-referral-landing', '/signup?ref=' + (STATE.refCode || 'X')),
      S('trial-card-guest', '/checkout?plan=explorer'), S('checkout-plans-guest', '/checkout'),
      S('payment-result-failed', '/payment/result?status=failed&kind=plan'), S('payment-result-success-plan', '/payment/result?status=success&kind=plan&plan=builder&billing=monthly'),
      S('payment-result-processing', '/payment/result?status=processing&kind=plan'), S('payment-result-order', '/payment/result?status=success&kind=order&order=0d2b7744-6ff5-46e4-a773-bd517a34c12a'),
      S('leader-invite', '/leader-invite'), S('offline', '/offline'), S('not-found-404', '/zz-no-such-page'),
    ];
    for (const sc of pub) for (const sz of Object.keys(SIZES)) { await shot(browser, sc, sz); process.stdout.write('.'); }
  }
  if (groups.includes('member') || groups.includes('plan')) {
    const m = await login(browser, 'member', '/login');
    console.log('\nmember signed in, landed on', m.where);
    STATE.memberAuth = m.stateFile;
  }
  if (groups.includes('member')) {
    const A = STATE.memberAuth;
    const mem = [
      S('member-dashboard', '/dashboard'), S('settings-account', '/settings?tab=account'), S('settings-profile', '/settings?tab=profile'),
      S('settings-security', '/settings?tab=security'), S('settings-alerts', '/settings?tab=alerts'),
      S('store-list', '/store'), S('store-product', '/store/zz-hoodie'), S('store-product-free', '/store/zz-free-guide'), S('store-cart', '/store/cart', { cart: true }), S('store-orders', '/store/orders?paid=1'),
      S('referral', '/referral'), S('messaging-inbox', '/messages'), S('messaging-new-message', '/messages?new=1'), S('notifications', '/notifications'), S('search', '/search?q=lesson'),
      S('help', '/help'), S('city-groups', '/community/cities'), S('meetup', '/community/meetups/yaba-study'),
      S('learn', '/learn'), S('circle', '/circle'), S('sessions', '/sessions'), S('growth', '/growth'), S('announcements', '/announcements'), S('whats-next', '/circle/next'), S('session-agenda', '/sessions/agenda'),
      S('checkout-trial-card-in-shell', '/checkout?plan=builder'), S('profile', '/profile'),
    ].map((x) => ({ ...x, auth: A }));
    for (const sc of mem) for (const sz of Object.keys(SIZES)) { await shot(browser, sc, sz); process.stdout.write('.'); }
  }
  if (groups.includes('plan')) {
    const A = STATE.memberAuth;
    const variant = process.argv[3 + 0];
    plans.push(S('settings-plan-' + (process.env.PLAN_LABEL || 'free'), '/settings?tab=plan', { auth: A }));
    for (const sc of plans) for (const sz of Object.keys(SIZES)) { await shot(browser, sc, sz); process.stdout.write('.'); }
  }
  if (groups.includes('admin')) {
    const a = await login(browser, 'admin', '/admin-login');
    console.log('\nadmin signed in, landed on', a.where);
    const adm = [S('admin-shop-products', '/admin/shop/products'), S('admin-shop-orders', '/admin/shop/orders'), S('admin-shop-leads', '/admin/shop/leads'),
      S('admin-shop-products-editor', '/admin/shop/products', { act: async (p) => { const b = p.getByRole('button', { name: /new product|add product|\+ new|new/i }).first(); if (await b.count()) { await b.click(); await sleep(1500); } } })]
      .map((x) => ({ ...x, auth: a.stateFile }));
    for (const sc of adm) for (const sz of Object.keys(SIZES)) { await shot(browser, sc, sz); process.stdout.write('.'); }
  }
  await browser.close();
  const file = path.join(__dirname, 'visual_report_' + groups.join('-') + (process.env.PLAN_LABEL ? '-' + process.env.PLAN_LABEL : '') + '.json');
  fs.writeFileSync(file, JSON.stringify(report, null, 1));
  console.log('\nreport written', path.basename(file), report.length, 'captures');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
