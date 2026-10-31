// Back-button behaviour around Google sign-in, and the "one auth theme" check. Real browsers, a phone viewport, real history.
// Google itself is stood in for: requests to accounts.google.com are answered with a redirect back to our callback (cancel, error,
// wrong state), so the browser history is the real one. A completed Google sign-in needs a real Google account and is NOT covered here.
// Usage: node scripts/visual/auth_back_e2e.cjs <custom|default> [chromium|webkit]
//   custom : start `npm run dev` with GOOGLE_AUTH_MODE=custom GOOGLE_OAUTH_CLIENT_ID=fake-client.apps.googleusercontent.com GOOGLE_OAUTH_CLIENT_SECRET=fake-secret-ok
//   default: start `npm run dev` with no Google variables (the Supabase button flow stays in place)
//   signed-in checks need scripts/visual/pw-member.json (written by sage_edge.cjs after `visual_fixtures.cjs up`)
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const pw = require(path.join(root, 'node_modules/playwright'));
const BASE = 'http://localhost:3000';
const phase = process.argv[2] || 'custom', engine = process.argv[3] || 'chromium';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  [${engine}] ${n}${x ? '  ' + x : ''}`); };
const iphone = { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
const path_ = (p) => new URL(p.url()).pathname;
const qs = (p) => new URL(p.url()).search;
const historyLen = (p) => p.evaluate(() => history.length);

// What Google "does" next, per scenario. The state is read from the real authorize request, so the callback sees what it would see.
let google = 'cancel';
// Playwright's WebKit cannot fulfill a request with a 3xx status. There, a redirect hop is answered with a tiny page that does
// location.replace(), which replaces the history entry exactly as a real redirect does.
const hop = (route, resp, location) => {
  const abs = new URL(location, 'http://localhost:3000').toString();
  const headers = { ...resp.headers() };
  if (engine !== 'webkit') return route.fulfill({ response: resp, headers: { ...headers, location: abs } });
  delete headers.location; delete headers['content-security-policy']; delete headers['content-length']; delete headers['content-encoding']; headers['content-type'] = 'text/html';
  return route.fulfill({ status: 200, headers, body: '<!doctype html><script>location.replace(' + JSON.stringify(abs) + ')</script>' });
};
async function stubGoogle(ctx) {
  // The redirect to Google is a server hop the browser follows by itself, so it is answered here: take our own response from
  // /api/auth/google (state cookie included), and swap only the Location, as if Google had sent the person straight back.
  await ctx.route(/\/api\/auth\/google(\?|$)/, async (route) => {
    const r = await route.fetch({ url: route.request().url().replace(/^https:/, 'http:'), maxRedirects: 0 });
    const loc = r.headers()['location'] || '';
    if (!/^https:\/\/accounts\.google\.com\//.test(loc)) return loc ? hop(route, r, loc) : route.fulfill({ response: r });
    const u = new URL(loc);
    const cb = u.searchParams.get('redirect_uri') || `${BASE}/api/auth/google/callback`;
    const state = u.searchParams.get('state') || '';
    const target = google === 'cancel' ? `${cb}?error=access_denied&state=${state}`
      : google === 'error' ? `${cb}?error=server_error&state=${state}`
      : google === 'badstate' ? `${cb}?code=good-code&state=WRONG`
      : `${cb}?code=bad-code&state=${state}`; // 'rejected': Google refuses the code
    await hop(route, r, target);
  });
}

async function startFrom(page, from) {
  await page.goto(`${BASE}${from}`, { waitUntil: 'load', timeout: 180000 }); await sleep(1200);
  await page.getByRole('button', { name: /Continue with Google/ }).first().click();
  await page.waitForURL((u) => new RegExp(`^${from}`).test(u.pathname) && /error=/.test(u.search), { timeout: 30000 }).catch(() => {});
  await sleep(800);
}

(async () => {
  const browser = await pw[engine].launch();
  const ctxOpts = engine === 'webkit' ? { ...iphone, isMobile: false } : iphone; // WebKit in Playwright has no isMobile
  // WebKit upgrades http://localhost sub-resources to https because of the app's CSP (upgrade-insecure-requests) and then cannot
  // load them from the plain-http dev server. Serve those requests over http, so the page runs the same code as in Chromium.
  const fixWebkit = async (c) => {
    if (engine !== 'webkit') return;
    await c.route('https://localhost:3000/**', async (r) => {
      try { const x = await r.fetch({ url: r.request().url().replace('https:', 'http:'), maxRedirects: 0 }); const l = x.headers()['location']; if (x.status() >= 300 && x.status() < 400 && l) await hop(r, x, l); else await r.fulfill({ response: x }); } catch { await r.abort(); }
    });
  };
  const mk = async (o) => { const c = await browser.newContext(o); await fixWebkit(c); return c; };
  const newCtx = async (extra = {}) => { const c = await mk({ ...ctxOpts, ...extra }); await stubGoogle(c); return c; };

  if (phase === 'custom') {
    for (const from of ['/signup', '/login']) {
      for (const [kind, expect] of [['cancel', 'google_cancelled'], ['error', 'google_failed'], ['badstate', 'google_state'], ['rejected', 'google_failed']].filter(([k]) => !process.env.SCEN || process.env.SCEN.split(',').includes(k))) {
        google = kind;
        const ctx = await newCtx(); const page = await ctx.newPage();
        await startFrom(page, from);
        check(`${from} -> Google ${kind}: returns to ${from}`, path_(page) === from && qs(page).includes(`error=${expect}`), `${path_(page)}${qs(page)}`);
        const msg = await page.locator('[role="alert"]').first().innerText().catch(() => '');
        check(`${from} -> Google ${kind}: a friendly message is shown on ${from}`, msg.length > 10, JSON.stringify(msg.slice(0, 60)));
        await page.goBack({ waitUntil: 'load' }).catch(() => {}); await sleep(800);
        check(`${from} -> Google ${kind} -> Back: stays on ${from}, never the other auth page`, path_(page) === from, `${path_(page)}${qs(page)}`);
        await ctx.close();
      }
    }
    // the start route also works when the browser sends no ?from= (Referer fallback) and refuses anything but the two values
    google = 'cancel';
    const bare = await fetch(`${BASE}/api/auth/google?from=https://evil.com`, { redirect: 'manual' });
    const c = /ascentor_google_oauth=([^;]+)/.exec(bare.headers.get('set-cookie') || '')?.[1] || '';
    check('start route: an invalid ?from= becomes login', JSON.parse(Buffer.from(c, 'base64url').toString()).from === 'login');
    const viaRef = await fetch(`${BASE}/api/auth/google`, { redirect: 'manual', headers: { referer: `${BASE}/signup` } });
    const c2 = /ascentor_google_oauth=([^;]+)/.exec(viaRef.headers.get('set-cookie') || '')?.[1] || '';
    check('start route: with no ?from=, the Referer /signup is used', JSON.parse(Buffer.from(c2, 'base64url').toString()).from === 'signup');
    const nx = await fetch(`${BASE}/api/auth/google?from=signup&next=${encodeURIComponent('/learn')}`, { redirect: 'manual' });
    const c3 = /ascentor_google_oauth=([^;]+)/.exec(nx.headers.get('set-cookie') || '')?.[1] || '';
    const f3 = JSON.parse(Buffer.from(c3, 'base64url').toString());
    check('start route: from and next are both kept in the state cookie', f3.from === 'signup' && f3.next === '/learn');
    // a refreshed callback after a finished sign-in must not show an error to a signed-out visitor without a cookie: back to where it started (login default)
    const lone = await fetch(`${BASE}/api/auth/google/callback?code=x&state=y`, { redirect: 'manual' });
    check('callback with no cookie and no session: /login?error=google_state', /\/login\?error=google_state/.test(lone.headers.get('location') || ''));
  }

  if (phase === 'default') {
    // Supabase button flow: the starting page is remembered in a cookie, and /auth/callback failures return there
    for (const from of ['/signup', '/login']) {
      const ctx = await mk(ctxOpts); const page = await ctx.newPage();
      // Supabase's authorize address answers with a redirect to our /auth/callback with a code that fails, as an expired link would
      await page.route(/supabase\.co\/auth\/v1\/authorize/, (r) => r.fulfill({ status: 302, headers: { location: BASE + '/auth/callback?code=bad' } }));
      await page.goto(`${BASE}${from}`, { waitUntil: 'load', timeout: 180000 }); await sleep(1200);
      await page.getByRole('button', { name: /Continue with Google/ }).first().click();
      await page.waitForURL((u) => u.pathname === from && /error=/.test(u.search), { timeout: 30000 }).catch(() => {}); await sleep(600);
      const ck = (await ctx.cookies()).find((c) => c.name === 'ascentor_auth_from');
      check(`default mode: Google button on ${from} remembers the starting page`, ck && ck.value === from.slice(1), ck ? ck.value : 'no cookie');
      check(`default mode: a failed /auth/callback returns to ${from}`, path_(page) === from && qs(page).includes('error=auth_failed'), `${path_(page)}${qs(page)}`);
      await page.goBack({ waitUntil: 'load' }).catch(() => {}); await sleep(800);
      check(`default mode: Back from there stays on ${from}`, path_(page) === from, path_(page));
      await ctx.close();
    }
  }

  // identical theme tokens on /login and /signup, light and dark (both modes)
  for (const scheme of ['light', 'dark']) {
    const read = async (route) => {
      const ctx = await mk({ ...ctxOpts, colorScheme: scheme }); const page = await ctx.newPage();
      await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 180000 }); await sleep(1500);
      const v = await page.evaluate(() => {
        const ax = document.querySelector('.ax'); if (!ax) return null;
        const cs = getComputedStyle(ax);
        const names = ['--ax-bg', '--ax-surface', '--ax-raised', '--ax-border', '--ax-line', '--ax-text', '--ax-muted', '--ax-rust', '--ax-rustt', '--ax-gold', '--ax-err', '--ax-ok', '--ax-input'];
        const t = {}; for (const n of names) t[n] = cs.getPropertyValue(n).trim();
        const bodyBg = getComputedStyle(document.body).backgroundColor;
        const btn = document.querySelector('.ax-btn.bp'); const sso = document.querySelector('.ax-sso'); const inp = document.querySelector('.ax-in');
        return { t, bodyBg, rootBg: cs.backgroundColor, rootFont: cs.fontFamily, btn: btn && getComputedStyle(btn).backgroundColor, sso: sso && getComputedStyle(sso).borderColor, inp: inp && getComputedStyle(inp).backgroundColor };
      });
      await page.screenshot({ path: path.join(root, 'docs', 'screenshots', 'auth-back', `${engine}-${route.slice(1)}-${scheme}.png`) }).catch(() => {});
      await ctx.close(); return v;
    };
    fs.mkdirSync(path.join(root, 'docs', 'screenshots', 'auth-back'), { recursive: true });
    const a = await read('/login'), b = await read('/signup');
    check(`theme (${scheme}): both pages use the shared auth layout`, !!a && !!b);
    if (a && b) {
      check(`theme (${scheme}): identical colour tokens`, JSON.stringify(a.t) === JSON.stringify(b.t), JSON.stringify(a.t) === JSON.stringify(b.t) ? '' : JSON.stringify({ a: a.t, b: b.t }));
      check(`theme (${scheme}): same page background, font, primary button, input and social button colours`, a.bodyBg === b.bodyBg && a.rootBg === b.rootBg && a.rootFont === b.rootFont && a.btn === b.btn && a.sso === b.sso && a.inp === b.inp, JSON.stringify({ a: [a.rootBg, a.btn, a.inp], b: [b.rootBg, b.btn, b.inp] }));
    }
  }

  // signed-in person pressing Back to /login or /signup
  const STATE = path.join(__dirname, 'pw-member.json');
  if (fs.existsSync(STATE)) {
    for (const route of ['/login', '/signup']) {
      const ctx = await mk({ ...ctxOpts, storageState: STATE }); const page = await ctx.newPage();
      await page.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 180000 }); await sleep(2500);
      let sawForm = false; page.on('framenavigated', () => {});
      const resp = await page.goto(`${BASE}${route}`, { waitUntil: 'commit', timeout: 180000 });
      await sleep(3000);
      sawForm = (await page.locator('.ax').count()) > 0 && /\/(login|signup)$/.test(path_(page));
      check(`signed in: ${route} sends the person on (no form)`, !/^\/(login|signup)$/.test(path_(page)) && !sawForm, `${path_(page)}`);
      check(`signed in: the redirect happens on the server (no flash of the form)`, !!resp && !!resp.request().redirectedFrom(), resp && resp.request().redirectedFrom() ? 'redirected' : 'not redirected');
      await page.goBack({ waitUntil: 'load' }).catch(() => {}); await sleep(1500);
      check(`signed in: Back from there does not show the form either`, !/^\/(login|signup)$/.test(path_(page)), path_(page));
      await ctx.close();
    }
  } else console.log('SKIP  signed-in checks (no scripts/visual/pw-member.json)');

  await browser.close(); const bad = res.filter((x) => !x).length; console.log(`\n${res.length - bad}/${res.length} checks passed`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
