// End-to-end check of Admin > Elevation Summit > Registrations > Delivery against a LOCAL mail sink.
// Needs: node scripts/visual/visual_fixtures.cjs up   (throwaway admin)
//        node scripts/visual/smtp_sink.cjs            (local mail server)
//        npm run dev with SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=sink@example.invalid SMTP_PASS=x
// Usage: node scripts/visual/delivery_e2e.cjs [scenario,...]   scenarios: full,pause,double,reload,failstop,cleanup
// It creates 9 test registrations (zz-sink-N@example.invalid), refuses to run if any real registration is unsent (it would
// mark that person as sent), and removes only the rows it created.
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..');
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env.local') });
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const { createClient } = require(path.join(root, 'node_modules/@supabase/supabase-js'));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual_state.json'), 'utf8'));
const BASE = 'http://localhost:3000', SINK = 'http://127.0.0.1:2526', N = 9;
const OUT = path.join(root, 'docs', 'screenshots', 'summit-delivery'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const mails = async () => { const l = await (await fetch(SINK + '/log')).json(); const c = {}; for (const m of l) if (/^zz-sink-/.test(m.to)) c[m.to] = (c[m.to] || 0) + 1; return c; };
const sink = (q) => fetch(SINK + q).then((r) => r.json());
const results = []; const check = (name, ok, extra = '') => { results.push([name, ok]); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };
const emailOf = (i) => `zz-sink-${i}@example.invalid`;

async function ids() { const { data } = await sb.from('summit_registrations').select('id,email').like('email', 'zz-sink-%@example.invalid'); return data || []; }
async function seed() {
  if ((await ids()).length) return;
  const now = new Date().toISOString();
  const rows = Array.from({ length: N }, (_, k) => ({ full_name: `ZZ Sink ${k + 1}`, email: emailOf(k + 1), whatsapp: `+2348000000${String(k).padStart(3, '0')}`, location: 'Lagos', organisation: 'ZZ test', current_role: 'tester', consent: true, status: 'confirmed', payment_status: 'paid', payment_reference: `zz-sink-${Date.now()}-${k}`, amount_paid: 0, currency: 'NGN', attendance_type: k % 2 ? 'virtual' : 'onsite', source: 'zz-delivery-test', paid_at: now, confirmed_at: now, created_at: new Date(Date.now() + k * 1000).toISOString() }));
  const { error } = await sb.from('summit_registrations').insert(rows);
  if (error) throw new Error('seed: ' + error.message);
}
async function reset() {
  const { error } = await sb.from('summit_registrations').update({ confirmation_email_sent_at: null, confirmation_email_status: null, confirmation_email_attempts: 0, confirmation_email_error_code: null, confirmation_email_error: null, confirmation_email_last_attempt_at: null }).like('email', 'zz-sink-%@example.invalid');
  if (error) throw new Error('reset: ' + error.message);
  await sink('/reset');
}
async function realUnsent() {
  const { data } = await sb.from('summit_registrations').select('id').eq('payment_status', 'paid').is('confirmation_email_sent_at', null).not('email', 'like', 'zz-sink-%@example.invalid');
  return (data || []).length;
}
async function dbState() { const { data } = await sb.from('summit_registrations').select('email,confirmation_email_status,confirmation_email_attempts,confirmation_email_error_code,confirmation_email_sent_at').like('email', 'zz-sink-%@example.invalid'); return data || []; }
const exactlyOnce = (c) => Object.keys(c).length === N && Object.values(c).every((v) => v === 1);

async function login(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 240000 });
  await page.fill('input[type="email"]', STATE.admin.email); await page.fill('input[type="password"]', STATE.admin.password);
  await Promise.all([page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 240000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await sleep(2500);
  return ctx;
}
const open = async (ctx) => { const p = await ctx.newPage(); await p.goto(BASE + '/admin/c/registrations/delivery', { waitUntil: 'load', timeout: 240000 }); await p.waitForSelector('text=Ticket email delivery', { timeout: 60000 }); return p; };
const tile = async (p, label) => Number(await p.locator('.kpi', { hasText: label }).first().locator('.v').innerText());
const runBtn = (p) => p.getByRole('button', { name: /^Resend all unsent/ });
const progress = async (p) => (await p.locator('[role=progressbar]').locator('xpath=..').innerText().catch(() => '')).replace(/\s+/g, ' ');

(async () => {
  const want = (process.argv[2] || 'full,pause,double,reload,failstop,cleanup').split(',');
  const browser = await chromium.launch(); const ctx = await login(browser);
  try {
    if (want.some((w) => w !== 'cleanup')) {
      const ru = await realUnsent(); if (ru > 0) throw new Error(`refusing to run: ${ru} real registrations are unsent and would be marked sent`);
      await seed(); await sink('/mode?auth=ok&delay=0');
    }
    if (want.includes('full')) {
      console.log('--- full run, then single resend');
      await reset(); const p = await open(ctx);
      check('tiles show the test people as Not sent', (await tile(p, 'Not sent')) === N, `notsent=${await tile(p, 'Not sent')}`);
      await p.screenshot({ path: path.join(OUT, 'delivery-before.png'), fullPage: true });
      await runBtn(p).click();
      await p.waitForSelector(`text=${N} of ${N} sent`, { timeout: 180000 });
      await p.waitForSelector('text=Everyone has been sent their ticket', { timeout: 30000 });
      check('progress reads "9 of 9 sent"', true);
      await p.screenshot({ path: path.join(OUT, 'delivery-done.png'), fullPage: true });
      const c = await mails(); check('every person got exactly one email', exactlyOnce(c), JSON.stringify(Object.values(c)));
      const st = await dbState(); check('database says sent, 1 attempt each', st.every((r) => r.confirmation_email_status === 'sent' && r.confirmation_email_attempts === 1 && r.confirmation_email_sent_at));
      await p.reload({ waitUntil: 'load' }); await p.waitForSelector('text=Ticket email delivery');
      check('after reload: Sent tile counts them and nothing is owed', (await tile(p, 'Not sent')) === 0);
      await p.fill('input[aria-label="Search by name or email"]', 'zz-sink-3');
      await p.getByRole('button', { name: 'Sent ·' }).first().click();
      const row = p.locator('tbody tr').first(); await row.waitFor();
      await Promise.all([row.getByRole('button', { name: /Resend this one/ }).click(), row.getByRole('button', { name: /Resend this one/ }).click({ force: true, timeout: 1500 }).catch(() => {})]);
      await sleep(7000);
      const c2 = await mails(); check('double click on one row sent one extra email, not two', c2[emailOf(3)] === 2, `count=${c2[emailOf(3)]}`);
      await p.close();
    }
    if (want.includes('pause')) {
      console.log('--- pause and resume');
      await reset(); await sink('/mode?delay=600'); const p = await open(ctx);
      await runBtn(p).click();
      await p.waitForFunction(() => /[1-9]\d* of 9 sent/.test(document.body.innerText), null, { timeout: 120000 });
      await p.getByRole('button', { name: /^Pause/ }).click();
      await p.waitForSelector('text=Paused', { timeout: 120000 });
      const mid = await mails(); const sentMid = Object.keys(mid).length;
      check('paused part way (not all, not none)', sentMid > 0 && sentMid < N, `sent=${sentMid}`);
      check('progress text while paused', /\d+ of 9 sent/.test(await progress(p)), await progress(p));
      await p.screenshot({ path: path.join(OUT, 'delivery-paused.png'), fullPage: true });
      await sleep(4000); check('nothing more is sent while paused', Object.keys(await mails()).length === sentMid);
      await p.getByRole('button', { name: 'Resume' }).click();
      await p.waitForSelector(`text=${N} of ${N} sent`, { timeout: 180000 });
      check('after resume everyone got exactly one email', exactlyOnce(await mails()));
      await p.close(); await sink('/mode?delay=0');
    }
    if (want.includes('double')) {
      console.log('--- double press from two browser tabs at once');
      await reset(); const a = await open(ctx); const b = await open(ctx);
      await Promise.all([runBtn(a).click(), runBtn(b).click()]);
      await Promise.all([a, b].map((p) => p.waitForFunction(() => /Everyone has been sent|Another send is holding|Finished/.test(document.body.innerText), null, { timeout: 240000 })));
      await sleep(3000);
      const c = await mails(); check('two simultaneous runs still send exactly one email each', exactlyOnce(c), JSON.stringify(Object.values(c)));
      await a.close(); await b.close();
    }
    if (want.includes('reload')) {
      console.log('--- page reloaded in the middle of a run');
      await reset(); await sink('/mode?delay=500'); let p = await open(ctx);
      await runBtn(p).click();
      await p.waitForFunction(() => /[1-9]\d* of 9 sent/.test(document.body.innerText), null, { timeout: 120000 });
      await p.reload({ waitUntil: 'load' }); await p.waitForSelector('text=Ticket email delivery');
      await sleep(12000); // the batch already in flight on the server finishes by itself
      const owing = await tile(p, 'Not sent').catch(() => -1);
      const sentNow = Object.keys(await mails()).length;
      check('after the reload the run is not running and part is sent', sentNow > 0, `sent=${sentNow}`);
      if (sentNow < N) {
        await p.waitForSelector('button:has-text("Resend all unsent")'); await runBtn(p).click();
        await p.waitForFunction(() => /Everyone has been sent|Finished/.test(document.body.innerText), null, { timeout: 180000 });
      }
      check('the next press carried on and nobody got two emails', exactlyOnce(await mails()), JSON.stringify(Object.values(await mails())));
      await p.close(); await sink('/mode?delay=0');
    }
    if (want.includes('failstop')) {
      console.log('--- login failure stops the run by itself');
      await reset(); await sink('/mode?auth=fail'); const p = await open(ctx);
      await runBtn(p).click();
      await p.waitForSelector('text=rejected our mailbox login', { timeout: 120000 });
      const txt = await progress(p); check('stops with a plain-language message', /rejected our mailbox login/.test(txt) && /still unsent/.test(txt), txt.slice(0, 200));
      await p.screenshot({ path: path.join(OUT, 'delivery-login-failure.png'), fullPage: true });
      const st = await dbState(); const failed = st.filter((r) => r.confirmation_email_status === 'failed');
      check('only the first person was tried, and is marked failed with a code', failed.length === 1 && failed[0].confirmation_email_error_code, JSON.stringify(failed.map((r) => r.confirmation_email_error_code)));
      check('nothing was emailed', Object.keys(await mails()).length === 0);
      await p.reload({ waitUntil: 'load' }); await p.waitForSelector('text=Ticket email delivery');
      check('Failed tab shows the reason in plain words', (await (async () => { await p.getByRole('button', { name: /^Failed/ }).click(); return p.locator('tbody').innerText(); })()).includes('rejected our mailbox login'));
      await p.screenshot({ path: path.join(OUT, 'delivery-failed-tab.png'), fullPage: true });
      await sink('/mode?auth=ok');
      console.log('   waiting out the 2 minute login cooldown (the server will not retry a rejected login sooner)');
      await sleep(125000);
      await p.getByRole('button', { name: /^All/ }).click(); await runBtn(p).click();
      await p.waitForFunction(() => /Everyone has been sent|Finished/.test(document.body.innerText), null, { timeout: 240000 });
      check('once the login works the next press finishes the job, one email each', exactlyOnce(await mails()), JSON.stringify(Object.values(await mails())));
      await p.close();
    }
  } catch (e) { console.log("ERROR:", e.message); results.push(["script error", false]);
  } finally {
    if (want.includes('cleanup')) {
      const mine = await ids(); const ok = mine.every((r) => /^zz-sink-\d+@example\.invalid$/.test(r.email));
      if (!ok) console.log('cleanup refused: unexpected rows'); else { const { error } = await sb.from('summit_registrations').delete().in('id', mine.map((r) => r.id)); console.log('cleanup:', error ? error.message : `removed ${mine.length} test registrations`); }
      console.log('remaining test rows:', (await ids()).length);
    }
    await browser.close();
    const bad = results.filter((r) => !r[1]); console.log(`\n${results.length - bad.length}/${results.length} checks passed`); process.exit(bad.length ? 1 : 0);
  }
})().catch((e) => { console.error('ERR', e.message); process.exit(2); });
