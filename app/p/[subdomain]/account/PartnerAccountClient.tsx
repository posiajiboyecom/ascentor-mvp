'use client';

// ============================================================
// app/p/[subdomain]/account/PartnerAccountClient.tsx
//
// Standalone account settings UI for partner platform members.
// ✦ 100% inline styles — no Tailwind (partner layout is isolated)
// ✦ Tabs: Profile · Security · Notifications · Account
// ✦ Avatar upload, password change, notification prefs, data export
// ✦ All partner CSS vars: --bg, --bg-card, --bg-input, --accent,
//   --text, --text-dim, --border, --success, --error
// ============================================================

import { useState, useRef, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ── Types ─────────────────────────────────────────────────
type Tab = 'profile' | 'security' | 'notifications' | 'account';

const INDUSTRIES = [
  'Technology', 'Finance & Banking', 'Consulting', 'Healthcare',
  'Education', 'Energy', 'Telecom', 'Government', 'NGO',
  'Real Estate', 'Manufacturing', 'Media & Entertainment',
  'Agriculture', 'Legal', 'Retail', 'Other',
];

const TIME_OPTIONS = [
  { value: '10min', label: '10 min/day' },
  { value: '15min', label: '15 min/day' },
  { value: '30min', label: '30 min/day' },
  { value: '60min', label: '1 hour/day' },
];

// ── Shared styles ─────────────────────────────────────────
const S = {
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 10,
    background: 'var(--bg-input)', color: 'var(--text)',
    border: '1px solid var(--border)', outline: 'none',
    fontSize: 13, boxSizing: 'border-box' as const,
    transition: 'border-color 0.15s',
  },
  label: {
    display: 'block' as const, fontSize: 10, fontWeight: 700,
    textTransform: 'uppercase' as const, letterSpacing: '0.08em',
    color: 'var(--text-dim)', marginBottom: 6,
  },
  card: {
    background: 'var(--bg-card)', border: '1px solid var(--border)',
    borderRadius: 14, padding: '20px 22px', marginBottom: 14,
  },
  cardTitle: {
    fontSize: 13, fontWeight: 700, color: 'var(--text)',
    marginBottom: 16, marginTop: 0,
  },
  btn: {
    padding: '9px 22px', borderRadius: 10, border: 'none',
    background: 'var(--accent)', color: '#000',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },
  btnGhost: {
    padding: '9px 22px', borderRadius: 10,
    border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-dim)',
    fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  row2: {
    display: 'grid' as const, gridTemplateColumns: '1fr 1fr', gap: 14,
  },
  fieldGroup: { marginBottom: 14 },
  divider: { borderTop: '1px solid var(--border)', margin: '16px 0' },
};

// ── Sub-components ────────────────────────────────────────
function Field({ label, required, children }: {
  label: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div style={S.fieldGroup}>
      <label style={S.label}>
        {label}{required && <span style={{ color: 'var(--accent)', marginLeft: 2 }}>*</span>}
      </label>
      {children}
    </div>
  );
}

function Banner({ success, message }: { success?: boolean; message: string }) {
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 10, marginTop: 10,
      background: success ? 'rgba(16,185,129,0.07)' : 'rgba(239,68,68,0.07)',
      border: `1px solid ${success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
      fontSize: 12, color: success ? '#10B981' : '#EF4444',
    }}>
      {message}
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: {
  label: string; sub: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ flex: 1, paddingRight: 16 }}>
        <p style={{ fontSize: 13, color: 'var(--text)', margin: 0, marginBottom: 2 }}>{label}</p>
        <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>{sub}</p>
      </div>
      <button onClick={() => onChange(!checked)} style={{
        width: 40, height: 22, borderRadius: 11, border: 'none',
        background: checked ? 'var(--accent)' : 'var(--bg-input)',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.2s',
      }}>
        <span style={{
          position: 'absolute', top: 3, width: 16, height: 16, borderRadius: '50%',
          background: checked ? '#000' : 'var(--text-dim)',
          left: checked ? '21px' : '3px',
          transition: 'left 0.2s, background 0.2s',
        }} />
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────
export default function PartnerAccountClient({
  profile, email, authProvider, userId, notifications,
}: {
  profile: any;
  email: string;
  authProvider: string;
  userId: string;
  notifications: any;
}) {
  const supabase = createClient();
  const router   = useRouter();
  const avatarRef = useRef<HTMLInputElement>(null);

  const [tab, setTab] = useState<Tab>('profile');

  // Profile state
  const [form, setForm] = useState({
    full_name:         profile?.full_name || '',
    current_role:      profile?.current_role || '',
    goal_role:         profile?.goal_role || '',
    industry:          profile?.industry || '',
    biggest_challenge: profile?.biggest_challenge || '',
    time_commitment:   profile?.time_commitment || '15min',
    avatar_url:        profile?.avatar_url || '',
  });
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [saveError, setSaveError] = useState('');
  const [avatarBusy, setAvatarBusy] = useState(false);

  // Security state
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwBusy, setPwBusy]     = useState(false);
  const [pwResult, setPwResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showPw, setShowPw]     = useState({ current: false, next: false, confirm: false });
  const isOAuth = authProvider !== 'email';

  // Notifications state
  const [notifs, setNotifs] = useState({
    email_coaching_summary:  notifications?.email_coaching_summary  ?? true,
    email_weekly_digest:     notifications?.email_weekly_digest     ?? true,
    email_expert_reminders:  notifications?.email_expert_reminders  ?? true,
    email_product_updates:   notifications?.email_product_updates   ?? true,
    email_community_activity:notifications?.email_community_activity ?? false,
    email_goal_reminders:    notifications?.email_goal_reminders    ?? true,
  });
  const [notifBusy, setNotifBusy]   = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // Account (danger) state
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting]           = useState(false);
  const [exporting, setExporting]         = useState(false);

  const initials = (form.full_name || 'U').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

  // ── Handlers ──────────────────────────────────────────
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setSaveError('Please select an image.'); return; }
    if (file.size > 2 * 1024 * 1024) { setSaveError('Max 2MB.'); return; }
    setAvatarBusy(true);
    const ext  = file.name.split('.').pop();
    const path = `avatars/${userId}.${ext}`;
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (upErr) { setSaveError('Upload failed: ' + upErr.message); setAvatarBusy(false); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
    setForm(f => ({ ...f, avatar_url: url }));
    setAvatarBusy(false);
    e.target.value = '';
  };

  const handleProfileSave = async () => {
    setSaving(true); setSaveError(''); setSaved(false);
    const { error } = await supabase.from('profiles').upsert({
      id: userId, full_name: form.full_name, current_role: form.current_role,
      goal_role: form.goal_role, industry: form.industry,
      biggest_challenge: form.biggest_challenge, time_commitment: form.time_commitment,
      updated_at: new Date().toISOString(),
    });
    if (error) setSaveError(error.message);
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    if (pw.next.length < 8) { setPwResult({ ok: false, msg: 'Password must be at least 8 characters.' }); return; }
    if (pw.next !== pw.confirm) { setPwResult({ ok: false, msg: 'Passwords do not match.' }); return; }
    if (pw.current === pw.next) { setPwResult({ ok: false, msg: 'New password must differ from current.' }); return; }
    setPwBusy(true); setPwResult(null);
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: pw.current });
    if (verifyErr) { setPwResult({ ok: false, msg: 'Current password is incorrect.' }); setPwBusy(false); return; }
    const { error: updateErr } = await supabase.auth.updateUser({ password: pw.next });
    if (updateErr) setPwResult({ ok: false, msg: updateErr.message });
    else { setPwResult({ ok: true, msg: 'Password updated successfully.' }); setPw({ current: '', next: '', confirm: '' }); }
    setPwBusy(false);
  };

  const handleNotifSave = async () => {
    setNotifBusy(true); setNotifSaved(false);
    await supabase.from('notification_preferences').upsert({ user_id: userId, ...notifs, updated_at: new Date().toISOString() });
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
    setNotifBusy(false);
  };

  const handleExport = async () => {
    setExporting(true);
    const [p, s, g] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase.from('coaching_sessions').select('*').eq('user_id', userId),
      supabase.from('user_goals').select('*').eq('user_id', userId),
    ]);
    const blob = new Blob([JSON.stringify({ exported_at: new Date().toISOString(), profile: p.data, sessions: s.data, goals: g.data }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `my-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    setExporting(false);
  };

  const handleDelete = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try { await supabase.from('deletion_requests').insert({ user_id: userId, email, status: 'pending', requested_at: new Date().toISOString() }); } catch { /* non-critical */ }
    await supabase.auth.signOut();
    router.push('/');
  };

  const pwStrength = pw.next.length >= 12 ? { label: 'Strong', color: '#10B981', pct: '100%' }
    : pw.next.length >= 10 ? { label: 'Good', color: 'var(--accent)', pct: '70%' }
    : pw.next.length >= 8  ? { label: 'Fair', color: '#3B82F6', pct: '45%' }
    : { label: 'Weak', color: '#EF4444', pct: '20%' };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile',       label: 'Profile' },
    { key: 'security',      label: 'Security' },
    { key: 'notifications', label: 'Alerts' },
    { key: 'account',       label: 'Account' },
  ];

  return (
    <div style={{ maxWidth: 560, paddingBottom: 40 }}>

      {/* ── Avatar + name header ──────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ position: 'relative' }}>
          <div
            onClick={() => avatarRef.current?.click()}
            style={{
              width: 60, height: 60, borderRadius: '50%', cursor: 'pointer',
              border: '2px solid var(--accent)', overflow: 'hidden',
              background: 'rgba(232,160,32,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {form.avatar_url
              ? <img src={form.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>{initials}</span>
            }
            <div style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,0,0,0.45)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
            >
              <span style={{ fontSize: 10, color: '#fff', fontWeight: 700 }}>
                {avatarBusy ? '…' : 'Edit'}
              </span>
            </div>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
        </div>
        <div>
          <p style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', margin: 0,
            fontFamily: 'var(--font-heading)', letterSpacing: '-0.01em' }}>
            {form.full_name || 'Your Name'}
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: '3px 0 0' }}>{email}</p>
          {form.current_role && form.goal_role && (
            <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: '4px 0 0' }}>
              {form.current_role}
              <span style={{ color: 'var(--accent)', margin: '0 6px' }}>→</span>
              {form.goal_role}
            </p>
          )}
        </div>
      </div>

      {/* ── Tab bar ──────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 2, padding: 4, borderRadius: 12,
        background: 'var(--bg-input)', marginBottom: 20, overflowX: 'auto' as const,
      }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none',
            background: tab === t.key ? 'var(--bg-card)' : 'transparent',
            color: tab === t.key ? 'var(--accent)' : 'var(--text-dim)',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            whiteSpace: 'nowrap' as const, transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════ */}
      {/* PROFILE TAB */}
      {/* ══════════════════════════════════════════ */}
      {tab === 'profile' && (
        <div style={S.card}>
          <p style={S.cardTitle}>Personal Information</p>

          <Field label="Full Name" required>
            <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Your full name" style={S.input} />
          </Field>

          <Field label="Email Address">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input value={email} disabled style={{ ...S.input, opacity: 0.5, flex: 1 }} />
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '4px 8px', borderRadius: 6, flexShrink: 0,
                background: 'rgba(16,185,129,0.1)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)',
              }}>Verified</span>
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4, marginBottom: 0 }}>
              Contact support to change your email.
            </p>
          </Field>

          <div style={{ ...S.row2, marginBottom: 14 }}>
            <Field label="Current Role" required>
              <input value={form.current_role} onChange={e => setForm(f => ({ ...f, current_role: e.target.value }))}
                placeholder="e.g. Senior Engineer" style={S.input} />
            </Field>
            <Field label="Goal Role" required>
              <input value={form.goal_role} onChange={e => setForm(f => ({ ...f, goal_role: e.target.value }))}
                placeholder="e.g. Engineering Manager" style={S.input} />
            </Field>
          </div>

          <div style={{ ...S.row2, marginBottom: 14 }}>
            <Field label="Industry" required>
              <select value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} style={S.input}>
                <option value="">Select industry</option>
                {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            </Field>
            <Field label="Daily Commitment">
              <select value={form.time_commitment} onChange={e => setForm(f => ({ ...f, time_commitment: e.target.value }))} style={S.input}>
                {TIME_OPTIONS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Biggest Challenge">
            <textarea value={form.biggest_challenge}
              onChange={e => setForm(f => ({ ...f, biggest_challenge: e.target.value }))}
              placeholder="What's your biggest professional challenge right now?"
              rows={3} style={{ ...S.input, resize: 'none' as const, lineHeight: 1.6 }} />
          </Field>

          {/* Journey preview */}
          {(form.current_role || form.goal_role) && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 16,
              background: 'rgba(232,160,32,0.05)', border: '1px solid rgba(232,160,32,0.12)',
            }}>
              <p style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>
                Your journey:{' '}
                <span style={{ color: 'var(--text)' }}>{form.current_role || '…'}</span>
                <span style={{ color: 'var(--accent)', margin: '0 8px' }}>→</span>
                <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{form.goal_role || '…'}</span>
              </p>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleProfileSave} disabled={saving || !form.full_name.trim()}
              style={{ ...S.btn, opacity: saving || !form.full_name.trim() ? 0.45 : 1 }}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
            {saved && <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>✓ Saved</span>}
            {saveError && <span style={{ fontSize: 12, color: '#EF4444' }}>{saveError}</span>}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* SECURITY TAB */}
      {/* ══════════════════════════════════════════ */}
      {tab === 'security' && (
        <div style={S.card}>
          <p style={S.cardTitle}>Change Password</p>

          {isOAuth ? (
            <div style={{
              padding: '14px', borderRadius: 10,
              background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.18)',
            }}>
              <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: 0 }}>
                You signed in with{' '}
                <strong style={{ color: '#3B82F6' }}>
                  {authProvider === 'google' ? 'Google' : authProvider === 'linkedin_oidc' ? 'LinkedIn' : authProvider}
                </strong>.
                Password is managed by your provider.
              </p>
            </div>
          ) : (
            <>
              <Field label="Current Password">
                <div style={{ position: 'relative' }}>
                  <input type={showPw.current ? 'text' : 'password'} value={pw.current}
                    onChange={e => setPw(p => ({ ...p, current: e.target.value }))}
                    placeholder="Enter current password"
                    style={{ ...S.input, paddingRight: 42 }} />
                  <button onClick={() => setShowPw(s => ({ ...s, current: !s.current }))}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-dim)', fontSize: 11 }}>
                    {showPw.current ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>

              <Field label="New Password">
                <div style={{ position: 'relative' }}>
                  <input type={showPw.next ? 'text' : 'password'} value={pw.next}
                    onChange={e => setPw(p => ({ ...p, next: e.target.value }))}
                    placeholder="Min 8 characters"
                    style={{ ...S.input, paddingRight: 42 }} />
                  <button onClick={() => setShowPw(s => ({ ...s, next: !s.next }))}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-dim)', fontSize: 11 }}>
                    {showPw.next ? 'Hide' : 'Show'}
                  </button>
                </div>
                {pw.next.length > 0 && (
                  <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--bg-input)', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: pwStrength.pct, background: pwStrength.color, borderRadius: 2, transition: 'width 0.3s' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: pwStrength.color, minWidth: 36 }}>{pwStrength.label}</span>
                  </div>
                )}
              </Field>

              <Field label="Confirm New Password">
                <div style={{ position: 'relative' }}>
                  <input type={showPw.confirm ? 'text' : 'password'} value={pw.confirm}
                    onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))}
                    placeholder="Re-enter new password"
                    style={{ ...S.input, paddingRight: 42 }} />
                  <button onClick={() => setShowPw(s => ({ ...s, confirm: !s.confirm }))}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      color: 'var(--text-dim)', fontSize: 11 }}>
                    {showPw.confirm ? 'Hide' : 'Show'}
                  </button>
                </div>
              </Field>

              <button onClick={handlePasswordChange}
                disabled={pwBusy || !pw.current || !pw.next || !pw.confirm}
                style={{ ...S.btn, opacity: pwBusy || !pw.current || !pw.next || !pw.confirm ? 0.45 : 1 }}>
                {pwBusy ? 'Updating…' : 'Update Password'}
              </button>

              {pwResult && <Banner success={pwResult.ok} message={pwResult.msg} />}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* NOTIFICATIONS TAB */}
      {/* ══════════════════════════════════════════ */}
      {tab === 'notifications' && (
        <div style={S.card}>
          <p style={S.cardTitle}>Email Preferences</p>

          <Toggle label="Coaching Summaries" sub="Weekly AI coaching digest" checked={notifs.email_coaching_summary} onChange={v => setNotifs(n => ({ ...n, email_coaching_summary: v }))} />
          <Toggle label="Weekly Digest" sub="Platform highlights every week" checked={notifs.email_weekly_digest} onChange={v => setNotifs(n => ({ ...n, email_weekly_digest: v }))} />
          <Toggle label="Expert Reminders" sub="Upcoming sessions & events" checked={notifs.email_expert_reminders} onChange={v => setNotifs(n => ({ ...n, email_expert_reminders: v }))} />
          <Toggle label="Goal Reminders" sub="Nudges to keep you on track" checked={notifs.email_goal_reminders} onChange={v => setNotifs(n => ({ ...n, email_goal_reminders: v }))} />
          <Toggle label="Community Activity" sub="New posts and replies" checked={notifs.email_community_activity} onChange={v => setNotifs(n => ({ ...n, email_community_activity: v }))} />
          <Toggle label="Product Updates" sub="New features and improvements" checked={notifs.email_product_updates} onChange={v => setNotifs(n => ({ ...n, email_product_updates: v }))} />

          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={handleNotifSave} disabled={notifBusy}
              style={{ ...S.btn, opacity: notifBusy ? 0.45 : 1 }}>
              {notifBusy ? 'Saving…' : 'Save Preferences'}
            </button>
            {notifSaved && <span style={{ fontSize: 12, color: '#10B981', fontWeight: 600 }}>✓ Saved</span>}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════ */}
      {/* ACCOUNT TAB */}
      {/* ══════════════════════════════════════════ */}
      {tab === 'account' && (
        <>
          {/* Export data */}
          <div style={S.card}>
            <p style={S.cardTitle}>Export Your Data</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 16px' }}>
              Download a JSON file of your profile, coaching sessions, and goals.
            </p>
            <button onClick={handleExport} disabled={exporting} style={{ ...S.btnGhost, opacity: exporting ? 0.5 : 1 }}>
              {exporting ? 'Exporting…' : 'Download My Data'}
            </button>
          </div>

          {/* Delete account */}
          <div style={{ ...S.card, borderColor: 'rgba(239,68,68,0.2)' }}>
            <p style={{ ...S.cardTitle, color: '#EF4444' }}>Delete Account</p>
            <p style={{ fontSize: 13, color: 'var(--text-dim)', margin: '0 0 16px' }}>
              This is permanent. All your data will be deleted within 48 hours.
              Type <strong style={{ color: 'var(--text)' }}>DELETE</strong> to confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="Type DELETE to confirm"
              style={{ ...S.input, marginBottom: 12, borderColor: deleteConfirm === 'DELETE' ? '#EF4444' : undefined }}
            />
            <button
              onClick={handleDelete}
              disabled={deleting || deleteConfirm !== 'DELETE'}
              style={{
                ...S.btn, background: '#EF4444', color: '#fff',
                opacity: deleting || deleteConfirm !== 'DELETE' ? 0.4 : 1,
              }}
            >
              {deleting ? 'Deleting…' : 'Delete My Account'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
