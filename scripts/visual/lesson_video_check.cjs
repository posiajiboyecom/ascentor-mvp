// End-to-end check of lesson videos: admin pastes a YouTube link, a member watches it in the player.
// Creates ONE throwaway lesson (slug zz-video-test), checks it, and deletes it. Needs `visual_fixtures.cjs up` and `npm run dev`.
const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '../..');
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env.local') });
const { chromium } = require(path.join(root, 'node_modules/playwright'));
const { createClient } = require(path.join(root, 'node_modules/@supabase/supabase-js'));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const STATE = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual_state.json'), 'utf8'));
const BASE = 'http://localhost:3000';
const OUT = path.join(root, 'docs', 'screenshots', 'lesson-video'); fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ID = 'jNQXAC9IVRw';
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`); };

async function login(browser, who) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'load', timeout: 180000 });
  await page.fill('input[type="email"]', STATE[who].email);
  await page.fill('input[type="password"]', STATE[who].password);
  await Promise.all([page.waitForURL((u) => !/login/.test(u.pathname), { timeout: 180000 }).catch(() => {}), page.click('button[type="submit"]')]);
  await sleep(2500);
  const f = path.join(__dirname, `pw-${who}.json`);
  await ctx.storageState({ path: f }); await ctx.close();
  return f;
}

(async () => {
  const { data: lesson, error } = await sb.from('rx_lessons').insert({ slug: 'zz-video-test', title: 'ZZ video test lesson', dimension: 'Mind', minutes: 3, format: 'Video', sort: 9999, published: true, body: 'Throwaway lesson for the video check.' }).select('id').single();
  if (error) throw error;
  const browser = await chromium.launch();
  try {
    const adminState = await login(browser, 'admin');
    const memberState = await login(browser, 'member');

    // ADMIN: paste a shorts link, see it parsed, preview it, save it
    const actx = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: adminState });
    const ap = await actx.newPage();
    await ap.goto(BASE + '/admin/lesson-videos', { waitUntil: 'load', timeout: 180000 });
    await sleep(3000);
    const input = ap.locator(`#v-${lesson.id}`);
    await input.scrollIntoViewIfNeeded();
    await input.fill('https://example.com/not-youtube');
    await sleep(300);
    check('admin: a non-YouTube link is rejected with a message', await ap.getByText('not a YouTube link we can read').first().isVisible());
    check('admin: Save is disabled for a bad link', await ap.locator(`#v-${lesson.id}`).locator('xpath=ancestor::div[contains(@class,"rx-card")]').getByRole('button', { name: 'Save video' }).isDisabled());
    await input.fill(`https://www.youtube.com/shorts/${ID}?feature=share`);
    await sleep(300);
    check('admin: a shorts link is parsed to its id', await ap.getByText(`(${ID})`).first().isVisible());
    const card = ap.locator(`#v-${lesson.id}`).locator('xpath=ancestor::div[contains(@class,"rx-card")]');
    await card.getByRole('button', { name: 'Preview video' }).click();
    await sleep(1500);
    const prev = await card.locator('iframe').first().getAttribute('src');
    check('admin: preview shows the player', !!prev && prev.includes('youtube-nocookie.com/embed/' + ID), '');
    await card.scrollIntoViewIfNeeded();
    await ap.screenshot({ path: path.join(OUT, 'admin-lesson-videos-390.jpg'), type: 'jpeg', quality: 70 });
    const over = await ap.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check('admin: no sideways scroll at 390px', over <= 0, `overflow=${over}`);
    await card.getByRole('button', { name: 'Save video' }).click();
    let row = { video_url: null };
    for (let i = 0; i < 40 && !row.video_url; i++) { await sleep(1000); ({ data: row } = await sb.from('rx_lessons').select('video_url').eq('id', lesson.id).single()); }
    check('admin: saved the canonical link', row.video_url === `https://www.youtube.com/watch?v=${ID}`, row.video_url);
    await actx.close();

    // MEMBER: the new lesson plays; existing lessons (no video yet, and a Reading one) still load
    for (const [label, vp] of [['390', { width: 390, height: 844 }], ['1440', { width: 1440, height: 900 }]]) {
      const mctx = await browser.newContext({ viewport: vp, storageState: memberState });
      const mp = await mctx.newPage();
      await mp.goto(BASE + '/learn/lesson/zz-video-test', { waitUntil: 'load', timeout: 180000 });
      await sleep(4000);
      const fr = mp.locator('iframe[title="ZZ video test lesson"]');
      const src = await fr.getAttribute('src').catch(() => null);
      check(`member @${label}: new lesson embeds youtube-nocookie`, !!src && src.includes(`youtube-nocookie.com/embed/${ID}`));
      check(`member @${label}: iframe is lazy and titled`, (await fr.getAttribute('loading').catch(() => null)) === 'lazy');
      const box = await mp.locator('.rx-video').first().boundingBox();
      check(`member @${label}: player is 16:9 and fits the screen`, !!box && Math.abs(box.width / box.height - 16 / 9) < 0.05 && box.width <= vp.width, box ? `${Math.round(box.width)}x${Math.round(box.height)}` : 'none');
      const o = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(`member @${label}: no sideways scroll`, o <= 0, `overflow=${o}`);
      await mp.screenshot({ path: path.join(OUT, `member-new-lesson-${label}.jpg`), type: 'jpeg', quality: 70 });
      if (label === '390') {
        await mp.goto(BASE + '/learn/lesson/choosing-what-you-practise', { waitUntil: 'load', timeout: 180000 }); await sleep(3000);
        const txt = await mp.evaluate(() => document.body.innerText);
        check('member: existing Video lesson with no video still shows its placeholder', /coming soon/i.test(txt) && !/Application error/i.test(txt));
        await mp.screenshot({ path: path.join(OUT, 'member-existing-lesson-390.jpg'), type: 'jpeg', quality: 70 });
        await mp.goto(BASE + '/learn/lesson/reading-a-job-post-like-an-analyst', { waitUntil: 'load', timeout: 180000 }); await sleep(3000);
        const t2 = await mp.evaluate(() => document.body.innerText);
        check('member: existing Reading lesson still loads', t2.length > 300 && !/Application error/i.test(t2));
      }
      await mctx.close();
    }
  } finally {
    await browser.close();
    await sb.from('rx_lesson_progress').delete().eq('lesson_id', lesson.id);
    const d = await sb.from('rx_lessons').delete().eq('id', lesson.id);
    console.log('cleanup of throwaway lesson:', d.error ? d.error.message : 'done');
  }
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
