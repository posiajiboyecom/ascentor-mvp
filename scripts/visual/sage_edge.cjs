// Does the floating Sage control sit on top of anything it should not? Measured, not eyeballed.
// For every route and width it finds the Sage control (.sage-tab after the redesign, .sage-orb before) and checks its box against the
// bottom tab bar, the top bar, the mobile menu button, the messaging dock and (on desktop) the page content in <main>.
// Usage: node scripts/visual/sage_edge.cjs <before|after> [--all] [--shots] [--widths 360,375,390,430,1280,1440] [route ...]
//   Needs: node scripts/visual/visual_fixtures.cjs up   and   npm run dev
// Phones are emulated as an iPhone with a bottom safe area (34px) and a top one (47px) through the DevTools protocol.
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual_state.json'), 'utf8'));
const BASE = 'http://localhost:3000';
const args = process.argv.slice(2);
const tag = args[0] || 'before';
const all = args.includes('--all'), shots = args.includes('--shots');
const wi = args.indexOf('--widths');
const widths = (wi >= 0 ? args[wi + 1] : '360,375,390,430,1280,1440').split(',').map(Number);
const given = args.filter((a, i) => i > 0 && a.startsWith('/'));
const KEY = ['/dashboard', '/learn', '/circle'];
const ALL = ['/dashboard', '/learn', '/circle', '/sessions', '/community', '/store', '/settings', '/profile', '/notifications', '/referral', '/help', '/experts', '/growth', '/search', '/messages', '/sage', '/coach', '/account', '/announcements'];
const routes = given.length ? given : all ? ALL : KEY;
const OUT = path.join(root, 'docs', 'screenshots', 'sage-edge'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (u) => u.replace(/\W+/g, '_').replace(/^_|_$/g, '') || 'home';

async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 240000 });
  await page.fill('input[type="email"]', STATE.member.email); await page.fill('input[type="password"]', STATE.member.password);
  await Promise.all([page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 240000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await sleep(3000);
  const f = path.join(__dirname, 'pw-member.json'); await ctx.storageState({ path: f }); await ctx.close(); return f;
}

// Runs in the page. Returns the Sage box and every collision.
const measure = () => {
  const box = (el) => { const r = el.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  const shown = (el) => { if (!el) return false; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const hit = (a, b) => a.l < b.r - 0.5 && a.r > b.l + 0.5 && a.t < b.b - 0.5 && a.b > b.t + 0.5;
  const sage = document.querySelector('.sage-tab') || document.querySelector('.sage-orb');
  if (!sage) return { present: false };
  const rootEl = sage.closest('.sage-root'); const rcs = rootEl ? getComputedStyle(rootEl) : null;
  if (!shown(sage) || (rcs && (rcs.display === 'none' || rcs.visibility === 'hidden'))) return { present: true, visible: false };
  const s = box(sage), vw = document.documentElement.clientWidth, vh = window.innerHeight;
  const out = { present: true, visible: true, sage: [Math.round(s.l), Math.round(s.t), Math.round(s.w), Math.round(s.h)], collisions: [], vw, vh };
  const obstacles = [['tab bar', 'nav[aria-label="Main"]'], ['top bar', '.sh-header'], ['menu button', '[aria-label="Open menu"]'], ['messaging dock', '.rxm-dock'], ['network pill', '.rx-netpill'], ['toast', '.rx-toast']];
  for (const [name, sel] of obstacles) for (const el of document.querySelectorAll(sel)) if (shown(el) && hit(s, box(el))) out.collisions.push(name);
  // page content: any visible leaf with text, or any control, inside <main>, on desktop widths
  if (vw >= 1024) {
    const main = document.querySelector('.sh-main') || document.querySelector('main');
    const seen = new Set();
    if (main) for (const el of main.querySelectorAll('a,button,input,select,textarea,h1,h2,h3,p,li,img,td,th,label,span')) {
      if (el.closest('.sage-root') || !shown(el)) continue;
      const interactive = el.matches('a,button,input,select,textarea') ;
      const hasText = el.children.length === 0 && (el.textContent || '').trim().length > 0;
      if (!interactive && !hasText && el.tagName !== 'IMG') continue;
      if (hit(s, box(el))) { seen.add(`${el.tagName.toLowerCase()}:${(el.textContent || '').trim().slice(0, 28)}`); if (seen.size >= 4) break; }
    }
    for (const x of seen) out.collisions.push('content ' + x);
  }
  out.bottomClear = Math.round(vh - s.b); // space between the Sage box and the bottom of the viewport
  return out;
};

(async () => {
  const browser = await chromium.launch(); const state = await login(browser);
  const lines = []; let bad = 0, checked = 0, hidden = 0;
  for (const w of widths) {
    const phone = w < 600;
    const ctx = await browser.newContext({
      viewport: { width: w, height: phone ? 780 : 900 }, storageState: state, deviceScaleFactor: phone ? 3 : 1, isMobile: phone, hasTouch: phone,
      userAgent: phone ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
    });
    for (const url of routes) {
      const page = await ctx.newPage();
      if (phone) { try { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }); } catch { /* not supported: measured without a safe area */ } }
      let res;
      try {
        await page.goto(BASE + url, { waitUntil: 'domcontentloaded', timeout: 120000 });
        await sleep(Number(process.env.WAIT || 3200));
        // the Summit invitation is a modal: Sage correctly steps aside for it, so close it before measuring
        await page.getByRole('button', { name: /Maybe later/ }).click({ timeout: 1500 }).catch(() => {}); await sleep(600);
        res = await page.evaluate(measure);
        if (shots && (KEY.includes(url) || (res.collisions && res.collisions.length))) await page.screenshot({ path: path.join(OUT, `${tag}-${slug(url)}-${w}.jpg`), type: 'jpeg', quality: 70 });
      } catch (e) { res = { error: String(e.message).slice(0, 100) }; }
      await page.close();
      const row = { url, w, ...res }; lines.push(row);
      if (res.error) { console.log(`${w} ${url.padEnd(16)} ERROR ${res.error}`); continue; }
      if (!res.present || !res.visible) { hidden++; console.log(`${w} ${url.padEnd(16)} ${res.present ? 'hidden' : 'no sage on page'}`); continue; }
      checked++; const c = res.collisions;
      if (c.length) bad++;
      console.log(`${w} ${url.padEnd(16)} box=${res.sage.join(',')} ${c.length ? 'OVERLAPS: ' + c.join(' | ') : 'clear'}`);
    }
    await ctx.close();
  }
  fs.writeFileSync(path.join(OUT, `report-${tag}.json`), JSON.stringify(lines, null, 1));
  console.log(`\n${tag}: ${checked} route/width checks with Sage visible, ${bad} with an overlap, ${hidden} with Sage hidden or absent`);
  await browser.close();
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
