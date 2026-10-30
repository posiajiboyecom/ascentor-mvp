// Local end-to-end check of the custom Google sign-in. Google itself cannot be reached from a test, so its token endpoint is stood in
// for by a stub (GOOGLE_OAUTH_TEST_TOKEN_ENDPOINT, honoured in development only). What this proves: the switch, the redirect to
// Google, the cookie, every refusal path, and that the old Supabase flow is used when the switch is off. What it cannot prove: a real
// account picking, and Supabase accepting a real Google id_token. See docs/google-oauth-custom.md for the live test.
// Usage: node scripts/visual/google_e2e.cjs <default|nocreds|custom>   (start `npm run dev` with the matching env first)
const path = require('path'); const http = require('http');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const BASE = 'http://localhost:3000', phase = process.argv[2] || 'default';
const results = []; const check = (n, ok, x = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const get = (p, headers = {}) => fetch(BASE + p, { redirect: 'manual', headers });
const loc = (r) => r.headers.get('location') || '';
const cookieFor = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');

(async () => {
  const stub = http.createServer((req, res) => { let b = ''; req.on('data', (d) => (b += d)); req.on('end', () => { const p = new URLSearchParams(b); const ok = p.get('client_secret') === 'fake-secret-ok' && p.get('code') === 'good-code'; res.writeHead(ok ? 200 : 400, { 'content-type': 'application/json' }); res.end(JSON.stringify(ok ? { id_token: 'stub.invalid.idtoken' } : { error: 'invalid_grant' })); }); }).listen(2527);

  if (phase === 'default' || phase === 'nocreds') {
    const m = await (await get('/api/auth/google/mode')).json();
    check(`${phase}: mode endpoint says custom=false`, m.custom === false);
    const r = await get('/api/auth/google');
    check(`${phase}: /api/auth/google does not start Google, it returns to /login`, r.status >= 300 && r.status < 400 && /\/login$/.test(loc(r)) && !/google\.com/.test(loc(r)), loc(r));
    const c = await get('/api/auth/google/callback?code=x&state=y');
    check(`${phase}: callback is inert`, /\/login$/.test(loc(c)));
    // the real button on /login still uses the Supabase flow
    const b = await chromium.launch(); const page = await (await b.newContext()).newPage();
    let hit = ''; await page.route(/supabase\.co\/auth\/v1\/authorize|accounts\.google\.com/, (rt) => { hit = rt.request().url(); rt.abort(); });
    await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 120000 });
    await page.getByRole('button', { name: /Continue with Google/ }).first().click(); await new Promise((r2) => setTimeout(r2, 4000));
    check(`${phase}: the Google button still goes to Supabase's authorize URL`, /supabase\.co\/auth\/v1\/authorize\?.*provider=google/.test(hit), hit.replace(/\?.*/, ''));
    await b.close();
  }

  if (phase === 'custom') {
    const m = await (await get('/api/auth/google/mode')).json(); check('custom: mode endpoint says custom=true', m.custom === true);
    const r = await get('/api/auth/google?next=' + encodeURIComponent('/learn?tab=1'));
    const u = new URL(loc(r)); const q = u.searchParams;
    check('custom: redirects to accounts.google.com', u.origin + u.pathname === 'https://accounts.google.com/o/oauth2/v2/auth');
    check('custom: scope, PKCE S256, nonce, state, client id, redirect uri', q.get('scope') === 'openid email profile' && q.get('code_challenge_method') === 'S256' && !!q.get('code_challenge') && !!q.get('nonce') && !!q.get('state') && q.get('client_id') === 'fake-client.apps.googleusercontent.com' && q.get('redirect_uri') === 'http://localhost:3000/api/auth/google/callback');
    const sc = r.headers.get('set-cookie') || '';
    check('custom: state cookie is HttpOnly, SameSite=Lax, 10 minutes, scoped to /api/auth/google', /HttpOnly/i.test(sc) && /SameSite=lax/i.test(sc) && /Max-Age=600/i.test(sc) && /Path=\/api\/auth\/google/i.test(sc), sc.replace(/ascentor_google_oauth=[^;]+/, 'ascentor_google_oauth=<value>'));
    const cookie = /ascentor_google_oauth=([^;]+)/.exec(sc)?.[1] || '';
    const flow = JSON.parse(Buffer.from(cookie, 'base64url').toString());
    check('custom: cookie keeps the safe return path', flow.next === '/learn?tab=1');
    const evil = await get('/api/auth/google?next=' + encodeURIComponent('https://evil.com')); const ec = /ascentor_google_oauth=([^;]+)/.exec(evil.headers.get('set-cookie') || '')?.[1] || '';
    check('custom: an off-site next is replaced by /dashboard', JSON.parse(Buffer.from(ec, 'base64url').toString()).next === '/dashboard');
    const H = (c) => ({ cookie: `ascentor_google_oauth=${c}` });
    check('callback: no cookie -> /login?error=google_state', /error=google_state/.test(loc(await get('/api/auth/google/callback?code=good-code&state=abc'))));
    check('callback: wrong state -> google_state', /error=google_state/.test(loc(await get('/api/auth/google/callback?code=good-code&state=WRONG', H(cookie)))));
    check('callback: missing state -> google_state', /error=google_state/.test(loc(await get('/api/auth/google/callback?code=good-code', H(cookie)))));
    const old = cookieFor({ ...flow, at: Date.now() - 11 * 60_000 });
    check('callback: 11 minute old cookie -> google_state', /error=google_state/.test(loc(await get(`/api/auth/google/callback?code=good-code&state=${flow.state}`, H(old)))));
    check('callback: user cancelled -> google_cancelled', /error=google_cancelled/.test(loc(await get('/api/auth/google/callback?error=access_denied'))));
    check('callback: Google error -> google_failed', /error=google_failed/.test(loc(await get('/api/auth/google/callback?error=server_error'))));
    const bad = await get(`/api/auth/google/callback?code=bad-code&state=${flow.state}`, H(cookie));
    check('callback: Google refuses the code -> google_failed, cookie cleared', /error=google_failed/.test(loc(bad)) && /Max-Age=0/i.test(bad.headers.get('set-cookie') || ''));
    const sup = await get(`/api/auth/google/callback?code=good-code&state=${flow.state}`, H(cookie));
    check('callback: Supabase refuses an invalid id_token -> google_failed (no session)', /error=google_failed/.test(loc(sup)) && !/sb-.*auth-token/.test(sup.headers.get('set-cookie') || ''), loc(sup));
    // the login page shows the friendly text
    const b = await chromium.launch(); const page = await (await b.newContext()).newPage();
    await page.goto(BASE + '/login?error=google_cancelled', { waitUntil: 'load', timeout: 120000 }); await new Promise((r2) => setTimeout(r2, 1500));
    check('login page shows the friendly cancelled message', /cancelled the Google sign-in/.test(await page.locator('body').innerText()));
    await page.screenshot({ path: path.join(root, 'docs', 'screenshots', 'google-oauth', 'login-cancelled.png') }).catch(() => {});
    // the button on /login goes to OUR route, which goes to Google
    let hit = ''; page.on('request', (rq) => { if (/accounts\.google\.com\/o\/oauth2/.test(rq.url())) hit = rq.url(); });
    await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 120000 });
    await page.getByRole('button', { name: /Continue with Google/ }).first().click(); await new Promise((r2) => setTimeout(r2, 4000));
    check('the login button now lands on Google via /api/auth/google', /accounts\.google\.com\/o\/oauth2\/v2\/auth/.test(hit) && /redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fapi%2Fauth%2Fgoogle%2Fcallback/.test(hit));
    await b.close();
    // rate limit
    let limited = false; for (let i = 0; i < 26 && !limited; i++) { const x = await get('/api/auth/google/callback?error=access_denied'); if (/google_rate/.test(loc(x))) limited = true; }
    check('rate limit kicks in on the callback', limited);
  }
  stub.close(); const bad = results.filter((x) => !x).length; console.log(`\n${results.length - bad}/${results.length} checks passed`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
