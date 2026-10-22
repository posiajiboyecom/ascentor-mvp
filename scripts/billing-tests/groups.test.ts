import test from 'node:test';
import assert from 'node:assert/strict';
import * as G from '../../lib/billing/group-rules';
import * as R from '../../lib/billing/rules';
import * as P from '../../lib/billing/preview';

const EM = String.fromCharCode(0x2014);
const d = (s: string) => new Date(s);
const NOW = d('2026-11-10T10:00:00Z');

const base = {
  now: NOW, currentGroupId: null as string | null, targetGroupId: 'g1', targetCreatedAt: d('2026-11-01T00:00:00Z'),
  targetActiveRows: 2, targetTotalRows: 2, history: [] as G.MembershipHistoryRow[],
};

test('codes: unambiguous alphabet, ASC- prefix, normalising', () => {
  for (const ch of 'ILO01') assert.ok(!G.CODE_ALPHABET.includes(ch), `${ch} must not be in the alphabet`);
  let i = 0;
  const code = G.makeGroupCode(() => i++ % G.CODE_ALPHABET.length);
  assert.match(code, /^ASC-[A-Z2-9]{4}$/);
  assert.equal(G.normaliseGroupCode('asc 7k2q'), 'ASC-7K2Q');
  assert.equal(G.normaliseGroupCode(' ASC7K2Q '), 'ASC-7K2Q');
  assert.equal(G.normaliseGroupCode('ASC-7K2Q'), 'ASC-7K2Q');
  assert.equal(G.normaliseGroupCode('ASC-7K2'), null);
  assert.equal(G.normaliseGroupCode('ASC-7K2O'), null); // O is not in the alphabet
  assert.equal(G.normaliseGroupCode('XYZ-7K2Q'), null);
  assert.equal(G.normaliseGroupCode(42), null);
  // every generated code survives normalisation unchanged
  for (let n = 0; n < 200; n++) {
    const c = G.makeGroupCode((m) => Math.floor(Math.random() * m));
    assert.equal(G.normaliseGroupCode(c), c);
  }
});

test('join: a fresh member can join an open group', () => {
  assert.deepEqual(G.checkJoin(base), { ok: true, already: false });
});

test('join: joining the group you are already in is fine (idempotent)', () => {
  assert.deepEqual(G.checkJoin({ ...base, currentGroupId: 'g1' }), { ok: true, already: true });
});

test('join: one group per person', () => {
  const r = G.checkJoin({ ...base, currentGroupId: 'g2' });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'in_group');
});

test('join: at most 10 members', () => {
  const r = G.checkJoin({ ...base, targetActiveRows: 10, targetTotalRows: 10 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'full');
  assert.equal(G.checkJoin({ ...base, targetActiveRows: 9, targetTotalRows: 9 }).ok, true);
});

test('join: a code is capped at 10 uses in total, leavers still count', () => {
  const r = G.checkJoin({ ...base, targetActiveRows: 4, targetTotalRows: 10 });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'code_used_up');
});

test('join: the code expires', () => {
  const created = d('2026-09-01T00:00:00Z');
  assert.equal(G.codeExpiresAt(created).toISOString(), '2026-10-16T00:00:00.000Z');
  const r = G.checkJoin({ ...base, targetCreatedAt: created });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.reason, 'expired');
  assert.equal(G.checkJoin({ ...base, targetCreatedAt: d('2026-10-01T00:00:00Z') }).ok, true);
});

test('switching: blocked for 90 days after joining a group, with the date', () => {
  const history = [{ joinedAt: d('2026-10-20T00:00:00Z'), hadOthers: true }];
  const r = G.checkJoin({ ...base, history });
  assert.equal(r.ok, false);
  if (!r.ok) {
    assert.equal(r.reason, 'switch_locked');
    assert.equal(r.canSwitchAt?.toISOString(), '2027-01-18T00:00:00.000Z');
    assert.match(r.message, /18 January 2027/);
  }
  // exactly at the 90 day mark the member may switch
  assert.equal(G.checkJoin({ ...base, now: d('2027-01-18T00:00:00Z'), targetCreatedAt: d('2027-01-10T00:00:00Z'), history }).ok, true);
  assert.equal(G.checkJoin({ ...base, now: d('2027-01-17T23:59:59Z'), history }).ok, false);
});

test('switching: leaving a group you were alone in does not lock you', () => {
  assert.equal(G.switchLockedUntil([{ joinedAt: d('2026-11-09T00:00:00Z'), hadOthers: false }], NOW), null);
  assert.equal(G.switchLockedUntil([], NOW), null);
});

test('switching: the latest real join decides the lock', () => {
  const lock = G.switchLockedUntil([
    { joinedAt: d('2026-01-01T00:00:00Z'), hadOthers: true },
    { joinedAt: d('2026-11-01T00:00:00Z'), hadOthers: true },
  ], NOW);
  assert.equal(lock?.toISOString(), '2027-01-30T00:00:00.000Z');
});

test('flags: accounts created within minutes of each other', () => {
  const f = G.detectGroupFlags([
    { userId: 'a', createdAt: d('2026-11-01T10:00:00Z'), cardSignatures: [] },
    { userId: 'b', createdAt: d('2026-11-01T10:06:00Z'), cardSignatures: [] },
    { userId: 'c', createdAt: d('2026-11-05T10:00:00Z'), cardSignatures: [] },
  ]);
  assert.equal(f.length, 1);
  assert.equal(f[0].kind, 'created_close');
  assert.equal(f[0].key, 'created_close:a+b');
});

test('flags: a card shared between two members', () => {
  const f = G.detectGroupFlags([
    { userId: 'a', createdAt: d('2026-10-01T00:00:00Z'), cardSignatures: ['SIG_1', 'SIG_2'] },
    { userId: 'b', createdAt: d('2026-10-09T00:00:00Z'), cardSignatures: ['SIG_2'] },
  ]);
  assert.deepEqual(f.map((x) => x.kind), ['shared_card']);
});

test('flags: a shared device hint, and the key does not depend on member order', () => {
  const a = { userId: 'a', createdAt: d('2026-10-01T00:00:00Z'), cardSignatures: [], device: 'h1' };
  const b = { userId: 'b', createdAt: d('2026-10-09T00:00:00Z'), cardSignatures: [], device: 'h1' };
  assert.equal(G.detectGroupFlags([a, b])[0].key, G.detectGroupFlags([b, a])[0].key);
  assert.equal(G.detectGroupFlags([{ ...a, device: null }, { ...b, device: null }]).length, 0);
});

test('flags: unrelated members raise nothing', () => {
  assert.deepEqual(G.detectGroupFlags([
    { userId: 'a', createdAt: d('2026-10-01T00:00:00Z'), cardSignatures: ['x'], device: 'd1' },
    { userId: 'b', createdAt: d('2026-10-09T00:00:00Z'), cardSignatures: ['y'], device: 'd2' },
    { userId: 'c', createdAt: d('2026-10-20T00:00:00Z'), cardSignatures: [], device: null },
  ]), []);
});

test('status: forming, active, broken', () => {
  assert.equal(G.nextGroupStatus(1, 'forming'), 'forming');
  assert.equal(G.nextGroupStatus(2, 'forming'), 'forming');
  assert.equal(G.nextGroupStatus(3, 'forming'), 'active');
  assert.equal(G.nextGroupStatus(5, 'broken'), 'active');
  assert.equal(G.nextGroupStatus(2, 'active'), 'broken');
  assert.equal(G.nextGroupStatus(0, 'broken'), 'broken');
});

test('completeness uses rules.ts: free Leaders excluded, mixed tiers and grace count', () => {
  const n = R.countActiveMembers([
    { state: 'trial' }, { state: 'active' }, { state: 'grace' }, { state: 'lapsed' }, { state: 'cancelled' }, { state: 'active', leaderFree: true },
  ]);
  assert.equal(n, 3);
  assert.equal(R.isGroupComplete(n), true);
  assert.equal(R.isGroupComplete(2), false);
});

test('describeStatus never mentions people or payments and uses no em dashes', () => {
  const lines = [
    G.describeStatus('forming', 1), G.describeStatus('forming', 2), G.describeStatus('active', 4), G.describeStatus('broken', 2), G.describeStatus('active', 3, true),
  ];
  for (const l of lines) {
    assert.ok(!l.includes(EM));
    assert.ok(!/fail|paid|card/i.test(l));
  }
  assert.match(lines[0], /2 more friends/);
  assert.match(lines[1], /1 more friend /);
});

// ── Display previews (lib/billing/preview.ts) ───────────────────────────────

const basePrev = {
  tier: 'explorer' as const, cycle: 'monthly' as const, currentPriceType: 'solo' as const, inGroup: false, groupComplete: false,
  creditBalanceKobo: 0, now: NOW,
};

test('preview: solo until the group is complete, then the group price', () => {
  assert.equal(P.previewNextCharge(basePrev).grossKobo, 300_000);
  assert.equal(P.previewNextCharge({ ...basePrev, inGroup: true, groupComplete: false }).priceType, 'solo');
  const g = P.previewNextCharge({ ...basePrev, inGroup: true, groupComplete: true });
  assert.equal(g.priceType, 'group');
  assert.equal(g.grossKobo, 200_000);
  assert.equal(g.groupKobo, 200_000);
  assert.equal(g.soloKobo, 300_000);
});

test('preview: a flagged group does not get the group price', () => {
  assert.equal(P.previewNextCharge({ ...basePrev, inGroup: true, groupComplete: true, groupFlagged: true }).priceType, 'solo');
});

test('preview: a locked yearly group price holds even when the group has broken', () => {
  const r = P.previewNextCharge({ ...basePrev, cycle: 'yearly', currentPriceType: 'group', lockedGroupPriceUntil: d('2027-06-01T00:00:00Z'), inGroup: true, groupComplete: false });
  assert.equal(r.priceType, 'group');
  assert.equal(r.grossKobo, 2_200_000);
});

test('preview: credit comes off the charge, up to the whole charge', () => {
  const part = P.previewNextCharge({ ...basePrev, creditBalanceKobo: 60_000 });
  assert.deepEqual([part.grossKobo, part.creditKobo, part.payKobo], [300_000, 60_000, 240_000]);
  const all = P.previewNextCharge({ ...basePrev, creditBalanceKobo: 900_000 });
  assert.deepEqual([all.creditKobo, all.payKobo], [300_000, 0]);
});

test('preview: a scheduled plan change shows the new tier and cycle', () => {
  const r = P.previewNextCharge({ ...basePrev, scheduled: { tier: 'builder', cycle: 'yearly' } });
  assert.equal(r.grossKobo, 7_000_000);
});

const fmt = (iso: string | null) => (iso ? iso.slice(0, 10) : '');
const words = (state: R.SubState, extra: Partial<Parameters<typeof P.stateWords>[0]> = {}) => P.stateWords({
  state, cancelAtPeriodEnd: false, trialEndsAt: '2026-11-08T00:00:00Z', nextChargeAt: '2026-11-08T00:00:00Z', periodEnd: '2026-12-01T00:00:00Z',
  graceEndsAt: '2026-11-15T00:00:00Z', amountLabel: '₦3,000', now: NOW, ...extra,
}, fmt);

test('state words: every state in plain language, no em dashes', () => {
  const all = [words('trial'), words('active'), words('active', { cancelAtPeriodEnd: true }), words('grace'), words('lapsed'), words('cancelled'), words('cancelled', { periodEnd: '2026-12-01T00:00:00Z' })];
  assert.deepEqual(all.slice(0, 6).map((w) => w.label), ['Free trial', 'Active', 'Cancelled', 'Payment due', 'Paused', 'Cancelled']);
  for (const w of all) assert.ok(!(w.headline + w.detail).includes(EM));
  assert.match(all[0].detail, /₦3,000 is on 2026-11-08|₦3,000/);
  assert.match(all[3].detail, /full access until 2026-11-15/);
  assert.match(all[4].detail, /Sage, Circle chat, advanced Learn and mentor sessions are paused/);
});

test('checkout summary: free for 7 days, first charge on day 8 with the exact date, cancel before to pay nothing', () => {
  const f = (x: Date) => x.toISOString().slice(0, 10);
  const s = P.checkoutSummary({ tier: 'explorer', cycle: 'monthly', withGroup: false, start: d('2026-11-01T10:00:00Z') }, f);
  assert.match(s.trialLine, /7 days.*2026-11-08/);
  assert.match(s.chargeLine, /day 8, 2026-11-08: ₦3,000 a month for Seeker/);
  assert.match(s.cancelLine, /not be charged/);
  assert.equal(s.groupLine, null);
  const g = P.checkoutSummary({ tier: 'builder', cycle: 'yearly', withGroup: true, start: d('2026-11-01T10:00:00Z') }, f);
  assert.match(g.groupLine ?? '', /₦55,000 a year/);
  assert.match(g.groupLine ?? '', /day 14/);
  assert.match(g.chargeLine, /₦70,000 a year/);
});
