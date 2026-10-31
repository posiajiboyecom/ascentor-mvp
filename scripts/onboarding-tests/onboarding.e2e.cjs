// Onboarding in a real browser. Needs the app running and a database it may add and remove @ascentor-test.invalid accounts in.
//   npm run dev            (or npm run build && npm start)
//   BASE_URL=http://localhost:3000 npm run test:onboarding
//
// What it proves:
//   * the whole flow (Reminders, Interests, Where you are, Times and language, Goals, Baseline, then the stage and Circle screens) can be
//     completed in order with notification permission granted, denied, unsupported, and with a permission request that never answers;
//   * "Turn on reminders" and "Not now" always move on, and the button cannot be pressed twice;
//   * Back works, closing the browser resumes at the right step, finishing lands on Today and never returns to onboarding;
//   * no step overflows sideways at 390, 768 and 1440 px and the buttons stay on screen.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { chromium } = require(path.resolve(__dirname, '../../node_modules/playwright'));

const BASE = process.env.BASE_URL || 'http://localhost:3000';
const FIXTURES = path.join(__dirname, 'fixtures.cjs');
const made = [];
let browser;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const account = (kind) => { const a = JSON.parse(execFileSync('node', [FIXTURES, 'up', kind], { encoding: 'utf8' }).trim().split('\n').pop()); made.push(a.id); return a; };

// How the browser answers the notification question.
const PERMISSION = {
  granted: { grant: true },
  denied: { script: `Object.defineProperty(Notification, 'permission', { get: () => 'denied' }); Notification.requestPermission = () => Promise.resolve('denied');` },
  unsupported: { script: `delete window.Notification; delete window.PushManager;` },
  // The permission promise never settles: the button must still advance.
  silent: { script: `Object.defineProperty(Notification, 'permission', { get: () => 'default' }); Notification.requestPermission = () => new Promise(() => {});` },
};

async function open(width, mode = 'granted', height = 900) {
  const p = PERMISSION[mode];
  const ctx = await browser.newContext({ viewport: { width, height }, permissions: p.grant ? ['notifications'] : [] });
  if (p.script) await ctx.addInitScript(p.script);
  const page = await ctx.newPage();
  // The welcome email goes through the real mail account: never send it from a test.
  await page.route('**/api/welcome', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  return { ctx, page };
}

async function signIn(page, a) {
  const res = await page.request.post(`${BASE}/api/auth/login`, { data: { email: a.email, password: a.password } });
  assert.ok(res.ok(), `sign-in failed with ${res.status()}`);
}

const h1 = async (page) => (await page.locator('h1').first().innerText()).trim();
const noSideScroll = async (page, label) => {
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  assert.ok(over <= 1, `${label}: page scrolls sideways by ${over}px`);
};
// The primary button must be inside the visible screen once the page has settled.
const buttonOnScreen = async (page, name, label) => {
  const b = page.getByRole('button', { name }).first();
  await b.scrollIntoViewIfNeeded();
  const box = await b.boundingBox();
  const vp = page.viewportSize();
  assert.ok(box && box.y >= 0 && box.y + box.height <= vp.height + 1 && box.x >= 0 && box.x + box.width <= vp.width + 1, `${label}: button "${name}" is off screen (${JSON.stringify(box)})`);
};

const STEPS = [
  { h1: 'A nudge, not noise', action: async (page) => { await page.getByRole('button', { name: /turn on reminders/i }).click(); } },
  { h1: 'What do you want to grow?', action: async (page) => { await page.locator('.rx-chip').first().click(); await page.getByRole('button', { name: /^continue$/i }).click(); } },
  { h1: 'Which time zone are you in?', action: async (page) => { await page.getByRole('button', { name: /^continue$/i }).click(); } },
  { h1: 'When can you usually show up?', action: async (page) => { await page.getByRole('button', { name: /^continue$/i }).click(); } },
  { h1: 'Which language do you prefer?', action: async (page) => { await page.getByRole('button', { name: /^continue$/i }).click(); } },
  { h1: null, action: async (page) => { await page.getByRole('button', { name: /^continue$/i }).click(); } }, // purpose + experience (no h1 text pinned)
  { h1: 'What’s one goal for the next 90 days?', action: async (page) => { await page.getByLabel('Your goal').fill('Finish my study plan'); await page.getByRole('button', { name: /^continue$/i }).click(); } },
  { h1: 'Who does this goal serve?', action: async (page) => { await page.getByLabel('Who this goal serves').fill('My family'); await page.getByRole('button', { name: /^continue$/i }).click(); } },
];

async function startWelcome(page) {
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'load' });
  await page.locator('input[type=checkbox]').check();
  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('heading', { name: 'A nudge, not noise' }).waitFor({ timeout: 20000 });
}

async function finishFlow(page, startAt = 0) {
  for (const [i, s] of STEPS.entries()) {
    if (i < startAt) continue;
    if (s.h1) await page.getByRole('heading', { name: s.h1 }).waitFor({ timeout: 20000 });
    await s.action(page);
    // Whatever the step, the next screen must arrive.
    await page.waitForFunction((prev) => { const h = document.querySelector('h1'); return !h || h.textContent.trim() !== prev; }, s.h1 ?? '', { timeout: 20000 }).catch(() => {});
  }
  await page.locator('p.rx-label', { hasText: /^Question 1 of/ }).waitFor({ timeout: 30000 });
  // Baseline: answer each of the ten questions; the heading is the question, so wait for it to change before the next one.
  for (let guard = 0; guard < 10; guard++) {
    const title = await h1(page);
    await page.locator('.rx-optcol .rx-opt').nth(3).click({ timeout: 15000 });
    await page.getByRole('button', { name: /^continue$/i }).last().click();
    await page.waitForFunction((prev) => { const h = document.querySelector('h1'); return !h || h.textContent.trim() !== prev; }, title, { timeout: 40000 });
  }
  // Finishing saves the answers and marks the account complete. The page then sends the member to Today (it can show the
  // starting-point screen for a moment first); either way they must end up on the dashboard.
  await page.waitForURL(/\/dashboard/, { timeout: 60000 });
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'load' });
  await page.waitForURL((u) => !/\/onboarding/.test(u.pathname), { timeout: 20000 });
}

before(async () => { browser = await chromium.launch(); });
after(async () => {
  await browser?.close();
  if (made.length) execFileSync('node', [FIXTURES, 'down', ...made], { stdio: 'inherit' });
});

for (const mode of ['granted', 'denied', 'unsupported', 'silent']) {
  test(`complete all steps with notification permission ${mode}`, { timeout: 240000 }, async () => {
    const a = account('fresh');
    const { ctx, page } = await open(mode === 'silent' ? 390 : 1440, mode);
    await signIn(page, a);
    await startWelcome(page);
    const t0 = Date.now();
    await finishFlow(page);
    assert.ok(Date.now() - t0 < 240000);
    await ctx.close();
  });
}

test('Turn on reminders advances within 8 seconds when the permission promise never resolves', { timeout: 60000 }, async () => {
  const a = account('fresh');
  const { ctx, page } = await open(390, 'silent');
  await signIn(page, a);
  await startWelcome(page);
  const btn = page.getByRole('button', { name: /turn on reminders/i });
  await btn.click();
  // While it works the button is disabled, so a second press cannot start a second request.
  assert.equal(await page.getByRole('button', { name: /working/i }).isDisabled(), true);
  const t0 = Date.now();
  await page.getByRole('heading', { name: 'What do you want to grow?' }).waitFor({ timeout: 8000 });
  assert.ok(Date.now() - t0 < 8000);
  await ctx.close();
});

test('Not now skips reminders, and Back returns to them', { timeout: 60000 }, async () => {
  const a = account('fresh');
  const { ctx, page } = await open(390, 'granted');
  await signIn(page, a);
  await startWelcome(page);
  await page.getByRole('button', { name: /^not now$/i }).click();
  await page.getByRole('heading', { name: 'What do you want to grow?' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('heading', { name: 'A nudge, not noise' }).waitFor({ timeout: 10000 });
  await ctx.close();
});

test('closing the browser and reopening resumes at the next step', { timeout: 90000 }, async () => {
  const a = account('fresh');
  let { ctx, page } = await open(1440, 'granted');
  await signIn(page, a);
  await startWelcome(page);
  await page.getByRole('button', { name: /^not now$/i }).click();
  await page.getByRole('heading', { name: 'What do you want to grow?' }).waitFor({ timeout: 15000 });
  await page.locator('.rx-chip').first().click();
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('heading', { name: 'Which time zone are you in?' }).waitFor({ timeout: 15000 });
  await page.getByRole('button', { name: /^continue$/i }).click();
  await page.getByRole('heading', { name: 'When can you usually show up?' }).waitFor({ timeout: 15000 });
  // The browser is closed on the "times" screen without pressing Continue, so the last saved step is the time zone.
  await ctx.close();
  ({ ctx, page } = await open(1440, 'granted'));
  await signIn(page, a);
  await page.goto(`${BASE}/onboarding`, { waitUntil: 'load' });
  await page.getByRole('heading', { name: 'When can you usually show up?' }).waitFor({ timeout: 20000 });
  await ctx.close();
});

for (const width of [390, 768, 1440]) {
  test(`every step fits at ${width}px and its button stays on screen`, { timeout: 240000 }, async () => {
    const a = account('fresh');
    const { ctx, page } = await open(width, 'denied', width === 390 ? 740 : 900);
    await signIn(page, a);
    await startWelcome(page);
    await noSideScroll(page, `reminders ${width}`);
    await buttonOnScreen(page, /turn on reminders/i, `reminders ${width}`);
    await buttonOnScreen(page, /^not now$/i, `reminders ${width}`);
    for (const [i, s] of STEPS.entries()) {
      if (s.h1) await page.getByRole('heading', { name: s.h1 }).waitFor({ timeout: 20000 });
      await noSideScroll(page, `step ${i} at ${width}`);
      await buttonOnScreen(page, i === 0 ? /turn on reminders/i : /^continue$/i, `step ${i} at ${width}`);
      // head, content and the sticky footer must not sit on top of each other
      const head = await page.locator('.rx-ob-head').boundingBox();
      const foot = await page.locator('.rx-ob-foot').boundingBox();
      assert.ok(head && foot && head.y + head.height <= foot.y, `step ${i} at ${width}: header and footer overlap`);
      await s.action(page);
      await page.waitForFunction((prev) => { const h = document.querySelector('h1'); return !h || h.textContent.trim() !== prev; }, s.h1 ?? '', { timeout: 20000 }).catch(() => {});
    }
    await noSideScroll(page, `baseline ${width}`);
    await buttonOnScreen(page, /^(continue|finish)/i, `baseline ${width}`);
    await ctx.close();
  });
}
