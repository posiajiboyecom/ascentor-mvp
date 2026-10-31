// Throwaway accounts for the onboarding browser tests. Everything is marked @ascentor-test.invalid and removed by `down`.
// It writes to the database named in .env.local, so run it only where adding and removing test rows is fine.
//   node scripts/onboarding-tests/fixtures.cjs up fresh|resume   -> prints JSON {id,email,password}
//   node scripts/onboarding-tests/fixtures.cjs down <id> [<id>...]
const path = require('path'); const root = path.resolve(__dirname, '../..');
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env.local'), quiet: true });
const { createClient } = require(path.join(root, 'node_modules/@supabase/supabase-js'));
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const [mode, a, ...rest] = process.argv.slice(2);
(async () => {
  if (mode === 'up') {
    const email = `e2e.onboarding.${a}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@ascentor-test.invalid`; const password = 'Ob7!kRt-4mQp-Ascent';
    const { data, error } = await sb.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: 'Onboard Tester' } });
    if (error) throw error;
    for (let i = 0; i < 12; i++) { const { data: p } = await sb.from('profiles').select('id').eq('id', data.user.id); if (p && p.length) break; await new Promise((r) => setTimeout(r, 500)); }
    const patch = { onboarding_completed: false, full_name: 'Onboard Tester' };
    if (a === 'resume') patch.onboarding_step = 'notify'; // finished Reminders earlier: reopening must resume at the next step
    const u = await sb.from('profiles').update(patch).eq('id', data.user.id); if (u.error) throw u.error;
    console.log(JSON.stringify({ id: data.user.id, email, password }));
  } else if (mode === 'down') {
    for (const id of [a, ...rest].filter(Boolean)) {
      await sb.from('notifications').delete().eq('user_id', id); await sb.from('member_presence').delete().eq('user_id', id);
      const r = await sb.auth.admin.deleteUser(id); if (r.error) console.error('delete', id, r.error.message);
      const p = await sb.from('profiles').select('id').eq('id', id); if (p.data && p.data.length) await sb.from('profiles').delete().eq('id', id);
    }
    console.log('removed');
  }
})().catch((e) => { console.error('ERR', e.message || e); process.exit(1); });
