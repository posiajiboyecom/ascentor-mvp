// Behaviour of the Sage edge tab: dragging, clamping, snapping, remembering, hiding. Needs fixtures up, `npm run dev`, and pw-member.json
// (written by sage_edge.cjs). Usage: node scripts/visual/sage_interact.cjs
const path = require('path');
const root = path.resolve(__dirname, '../..');
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const STATE = path.join(__dirname, 'pw-member.json');
const BASE = 'http://localhost:3000';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const check = (n, ok, x = '') => { res.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${x ? '  ' + x : ''}`); };
const rect = (p) => p.evaluate(() => { const r = document.querySelector('.sage-tab')?.getBoundingClientRect(); const h = document.querySelector('.sh-header')?.getBoundingClientRect(); const n = document.querySelector('nav[aria-label="Main"]'); const nr = n && getComputedStyle(n).display !== 'none' ? n.getBoundingClientRect() : null; return r ? { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height, headerBottom: h ? h.bottom : 0, navTop: nr ? nr.top : window.innerHeight, vw: innerWidth, vh: innerHeight } : null; });

async function open(browser, opts) {
  const ctx = await browser.newContext({ storageState: STATE, ...opts });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('sage:greeted', '1'); } catch {} });
  const p = await ctx.newPage();
  await p.goto(BASE + '/dashboard', { waitUntil: 'domcontentloaded', timeout: 120000 }); await sleep(3500);
  await p.getByRole('button', { name: /Maybe later/ }).click({ timeout: 1500 }).catch(() => {}); await sleep(600);
  return { ctx, p };
}
const dragTo = async (p, from, to) => { await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 }); await p.mouse.move(to.x, to.y, { steps: 8 }); await p.mouse.up(); await sleep(300); };
const centre = (r) => ({ x: (r.l + r.r) / 2, y: (r.t + r.b) / 2 });

(async () => {
  const browser = await chromium.launch();
  for (const [name, opts] of [['phone 390', { viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['desktop 1440', { viewport: { width: 1440, height: 900 } }]]) {
    console.log(`--- ${name}`);
    const phone = name.startsWith('phone');
    let { ctx, p } = await open(browser, opts);
    let r = await rect(p);
    check('tab is at least 44px in both directions', r && r.w >= 44 && r.h >= 44, r ? `${r.w}x${r.h}` : '');
    check('starts on the right edge, in the upper-middle', r && Math.abs(r.r - r.vw) < 1 && r.t < r.vh / 2, r ? `top=${Math.round(r.t)} of ${r.vh}` : '');
    await dragTo(p, centre(r), { x: centre(r).x, y: -300 });
    r = await rect(p); check('dragged far up: stops below the top bar', r.t >= r.headerBottom + 8, `top=${Math.round(r.t)} header=${Math.round(r.headerBottom)}`);
    const topPos = r.t;
    await dragTo(p, centre(r), { x: centre(r).x, y: 5000 });
    r = await rect(p); check('dragged far down: stops above the bottom tab bar / screen bottom', r.b <= r.navTop - 8, `bottom=${Math.round(r.b)} limit=${Math.round(r.navTop)}`);
    if (phone) {
      await dragTo(p, centre(r), { x: 20, y: centre(r).y - 150 });
      r = await rect(p); check('phone: dragged to the left half: snaps to the left edge', Math.abs(r.l) < 1, `left=${Math.round(r.l)}`);
    } else {
      await dragTo(p, centre(r), { x: 20, y: centre(r).y - 150 });
      r = await rect(p); check('desktop: stays on the right edge (the left edge is the sidebar)', Math.abs(r.r - r.vw) < 1);
    }
    const saved = await p.evaluate(() => localStorage.getItem('sage:tab:v1'));
    check('position saved for this device', !!saved && /ratio/.test(saved), saved || '');
    const before = await rect(p);
    await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(3500); await p.getByRole('button', { name: /Maybe later/ }).click({ timeout: 1500 }).catch(() => {}); await sleep(500);
    const after = await rect(p); check('position is restored after a reload', after && Math.abs(after.t - before.t) < 3 && Math.abs(after.l - before.l) < 2, `${Math.round(before.t)} -> ${Math.round(after.t)}`);
    // keyboard
    await p.evaluate(() => document.querySelector('.sage-tab').focus());
    const k0 = (await rect(p)).t; await p.keyboard.press('ArrowDown'); await sleep(200); const k1 = (await rect(p)).t;
    check('arrow keys move the tab', Math.abs(k1 - k0 - 24) < 2 || k1 !== k0, `${Math.round(k0)} -> ${Math.round(k1)}`);
    // outline for keyboard focus
    check('keyboard focus is visible', await p.evaluate(() => { const t = document.querySelector('.sage-tab'); t.focus(); return parseFloat(getComputedStyle(t).outlineWidth) >= 2 || getComputedStyle(t).outlineStyle !== 'none'; }));
    const label = await p.evaluate(() => document.querySelector('.sage-tab').getAttribute('aria-label'));
    check('clear aria-label', /Open Sage/.test(label || ''), label || '');
    // hide rules
    if (phone) {
      await p.locator('[aria-label="Open menu"]').click(); await sleep(500);
      check('hidden while the mobile menu is open', await p.evaluate(() => getComputedStyle(document.querySelector('.sage-root')).display === 'none'));
      await p.keyboard.press('Escape'); await p.evaluate(() => document.querySelector('.sh-backdrop')?.click()); await sleep(500);
    }
    await p.evaluate(() => document.documentElement.setAttribute('data-sage-kb', ''));
    check('hidden while the on-screen keyboard is up', await p.evaluate(() => getComputedStyle(document.querySelector('.sage-root')).display === 'none'));
    await p.evaluate(() => document.documentElement.removeAttribute('data-sage-kb'));
    await p.evaluate(() => { const d = document.createElement('div'); d.id = 'zz-modal'; d.setAttribute('aria-modal', 'true'); d.setAttribute('role', 'dialog'); document.body.appendChild(d); });
    check('hidden while a modal is open', await p.evaluate(() => getComputedStyle(document.querySelector('.sage-root')).display === 'none'));
    await p.evaluate(() => document.getElementById('zz-modal').remove());
    const z = await p.evaluate(() => ({ sage: +getComputedStyle(document.querySelector('.sage-root')).zIndex, scrim: 55 }));
    check('z-index stays below drawers and modals', z.sage < 55, `z=${z.sage}`);
    // dismiss for the session
    await p.evaluate(() => document.querySelector('.sage-tab').focus());
    await p.locator('.sage-tab-x').click({ force: true }); await sleep(400);
    check('"hide for this session" removes the tab', (await p.locator('.sage-tab').count()) === 0);
    await p.reload({ waitUntil: 'domcontentloaded' }); await sleep(3000);
    check('and it stays hidden after a reload in the same session', (await p.locator('.sage-tab').count()) === 0);
    await ctx.close();
    // reduced motion
    ({ ctx, p } = await open(browser, { ...opts, reducedMotion: 'reduce' }));
    check('reduced motion: no transitions on the tab', await p.evaluate(() => { const c = getComputedStyle(document.querySelector('.sage-tab')); return c.transitionDuration.split(',').every((x) => parseFloat(x) === 0); }));
    await ctx.close();
  }
  await browser.close(); const bad = res.filter((x) => !x).length; console.log(`\n${res.length - bad}/${res.length} checks passed`); process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
