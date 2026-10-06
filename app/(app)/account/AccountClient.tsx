// app/(app)/account/AccountClient.tsx
// Settings, in five tabs with no repeated information:
//   Account       who you are (name, email, member since, sign-in method: read-only), sign out, delete account
//   Profile       the journey details used to personalise Ascentor (editable)
//   Security      change password, sign out of every device
//   Plan          current plan and billing
//   Alerts        email notification preferences

'use client';

import { useState, useRef } from 'react';
import { confirmAction } from '@/components/Modal';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { Check, CalendarDays, Mail, UserRound, LogOut, Trash2, Monitor } from 'lucide-react';
import { ProviderIcon, PROVIDER_NAME } from '@/components/auth/ProviderIcon';
import AuthModal from '@/components/auth/AuthModal';

const industries = [
  'Technology', 'Finance & Banking', 'Consulting', 'Healthcare',
  'Education', 'Energy', 'Telecom', 'Government', 'NGO',
  'Real Estate', 'Manufacturing', 'Media & Entertainment',
  'Agriculture', 'Legal', 'Retail', 'Other',
];

// Must match the profiles_time_commitment_check constraint.
const timeOptions = [
  { value: '5min',  label: '5 min/day' },
  { value: '15min', label: '15 min/day' },
  { value: '30min', label: '30 min/day' },
];

export const ASCENT_STAGES = [
  { value: 'seeker',  label: 'The Seeker',  sub: 'Finding my purpose' },
  { value: 'builder', label: 'The Builder', sub: 'Building toward it' },
  { value: 'leader',  label: 'The Leader',  sub: 'Leading others' },
] as const;

type Section = 'account' | 'profile' | 'security' | 'plan' | 'notifications';

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'account',       label: 'Account' },
  { key: 'profile',       label: 'Profile' },
  { key: 'security',      label: 'Security' },
  { key: 'plan',          label: 'Plan' },
  { key: 'notifications', label: 'Alerts' },
];

export default function AccountClient({ profile, email, authProvider, providers, memberSince, userId, notifications }: {
  profile: any;
  email: string;
  authProvider: string;
  /** Every sign-in method on the account (email, google, linkedin_oidc). */
  providers: string[];
  /** ISO timestamp the account was created. */
  memberSince: string;
  userId: string;
  notifications: any;
}) {
  const supabase = createClient();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [section, setSection] = useState<Section>('account');

  const methods = providers.length ? providers : [authProvider];
  const hasPassword = methods.includes('email');
  const fullName: string = profile?.full_name && profile.full_name !== 'New User' ? profile.full_name : (email.split('@')[0] || 'Member');

  // ═══ PROFILE ═══
  const [form, setForm] = useState({
    current_role:      profile?.current_role || '',
    industry:          profile?.industry || '',
    goal_role:         profile?.goal_role || '',
    biggest_challenge: profile?.biggest_challenge || '',
    time_commitment:   profile?.time_commitment || '15min',
    avatar_url:        profile?.avatar_url || '',
    ascent_stage:      profile?.ascent_stage || '',
    what_building:     profile?.what_building || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');

  // ═══ SECURITY ═══
  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwResult, setPwResult] = useState<{ success?: boolean; message: string } | null>(null);
  const [signingOutAll, setSigningOutAll] = useState(false);

  // ═══ ALERTS ═══
  const [notifs, setNotifs] = useState({
    email_coaching_summary:   notifications?.email_coaching_summary   ?? true,
    email_weekly_digest:      notifications?.email_weekly_digest      ?? true,
    email_expert_reminders:   notifications?.email_expert_reminders   ?? true,
    email_product_updates:    notifications?.email_product_updates    ?? true,
    email_community_activity: notifications?.email_community_activity ?? false,
    email_goal_reminders:     notifications?.email_goal_reminders     ?? true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // ═══ ACCOUNT ═══
  const [signingOut, setSigningOut] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [problem, setProblem] = useState<{ title: string; message: string } | null>(null);

  const initials = fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);

  // ── handlers ──
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError('');
    if (!file.type.startsWith('image/')) { setAvatarError('Please select an image file (JPG, PNG, or WebP).'); return; }
    if (file.size > 2 * 1024 * 1024) { setAvatarError('Image must be under 2MB. Please choose a smaller file.'); return; }

    setAvatarUploading(true);
    const ext = file.name.split('.').pop();
    const path = `avatars/${userId}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (uploadError) {
      console.error('Upload error:', uploadError);
      setAvatarError('Upload failed: ' + uploadError.message);
      setAvatarUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const urlWithCache = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('profiles').update({ avatar_url: urlWithCache }).eq('id', userId);
    setForm({ ...form, avatar_url: urlWithCache });
    setAvatarUploading(false);
    e.target.value = '';
  };

  const handleProfileSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    // The name is part of the account and is not edited here.
    const { error: dbError } = await supabase
      .from('profiles')
      .update({
        current_role:      form.current_role || null,
        industry:          form.industry || null,
        goal_role:         form.goal_role || null,
        biggest_challenge: form.biggest_challenge || null,
        time_commitment:   form.time_commitment || null,
        ascent_stage:      form.ascent_stage || null,
        what_building:     form.what_building || null,
        updated_at:        new Date().toISOString(),
      })
      .eq('id', userId);
    if (dbError) setError(dbError.message);
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    setPwSaving(true); setPwResult(null);
    if (passwords.newPassword.length < 10) {
      setPwResult({ success: false, message: 'New password must be at least 10 characters.' });
      setPwSaving(false); return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      setPwResult({ success: false, message: 'Passwords do not match.' });
      setPwSaving(false); return;
    }
    // The server verifies the current password, applies the password policy (including the
    // breached-password check), keeps THIS session, signs every other device out, and emails a notice.
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: passwords.current, newPassword: passwords.newPassword }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPwResult({ success: false, message: result.error || 'Could not update your password. Please try again.' });
      } else {
        setPwResult({ success: true, message: result.message || 'Password updated.' });
        setPasswords({ current: '', newPassword: '', confirm: '' });
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) router.push('/login?reason=session_expired');
      }
    } catch {
      setPwResult({ success: false, message: 'Network error. Please check your connection and try again.' });
    }
    setPwSaving(false);
  };

  const handleSignOutAll = async () => {
    if (!(await confirmAction('Sign out of every device, including this one?', { title: 'Sign out everywhere?', confirmLabel: 'Sign out everywhere' }))) return;
    setSigningOutAll(true);
    await supabase.auth.signOut({ scope: 'global' });
    router.push('/login');
  };

  const handleSignOut = async () => {
    if (!(await confirmAction('Sign out of Ascentor on this device?', { title: 'Sign out?', confirmLabel: 'Sign out' }))) return;
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/');
  };

  const handleNotifSave = async () => {
    setNotifSaving(true); setNotifSaved(false);
    await supabase.from('notification_preferences').upsert({ user_id: userId, ...notifs, updated_at: new Date().toISOString() });
    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
    setNotifSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    const ok = await confirmAction(
      'This permanently deletes your account, goals, commitments, coaching sessions and messages. It cannot be undone.',
      { title: 'Delete your account?', confirmLabel: 'Delete permanently' },
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE', ...(hasPassword ? { password: deletePassword } : {}) }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const titles: Record<string, string> = {
          subscription_active: 'Cancel your subscription first',
          wrong_password: 'That password is not correct',
          password_required: 'Enter your password',
          staff_account: 'Staff accounts cannot be deleted here',
          owns_partner: 'You own a partner platform',
        };
        setProblem({ title: titles[result.code] ?? 'We could not delete your account', message: result.error || 'Something went wrong. Please try again.' });
        setDeleting(false);
        return;
      }
      await supabase.auth.signOut().catch(() => undefined);
      window.location.assign('/');
    } catch {
      setProblem({ title: 'Network error', message: 'We could not reach the server. Nothing was deleted. Please try again.' });
      setDeleting(false);
    }
  };

  const joined = new Date(memberSince).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className="animate-fade-up py-6 max-w-3xl mx-auto">
      {problem && (
        <AuthModal open title={problem.title} message={problem.message} onClose={() => setProblem(null)}
          actions={problem.title === 'Cancel your subscription first' ? [{ label: 'Go to Plan', onClick: () => { setProblem(null); setSection('plan'); } }] : []} />
      )}

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative group">
          {form.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.avatar_url} alt="Avatar" className="w-14 h-14 rounded-full object-cover" style={{ border: '2px solid rgba(200,169,110,0.3)' }} />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ background: 'rgba(200,169,110,0.12)', color: 'var(--accent-dim)', border: '2px solid rgba(200,169,110,0.3)' }}>
              {initials}
            </div>
          )}
          <button onClick={() => avatarInputRef.current?.click()} aria-label="Change profile picture"
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
            style={{ background: 'rgba(15,15,14,0.5)' }}>
            <span className="text-white text-xs">{avatarUploading ? '...' : 'Edit'}</span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          {avatarError && (
            <p className="absolute left-0 top-full mt-1.5 text-[11px] leading-snug whitespace-nowrap z-20" style={{ color: 'var(--error)' }}>{avatarError}</p>
          )}
        </div>
        <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>Settings</h1>
      </div>

      {/* ═══ TABS ═══ */}
      <div role="tablist" className="flex gap-1 mb-5 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-input)', scrollbarWidth: 'none' }}>
        {SECTIONS.map((t) => (
          <button key={t.key} role="tab" aria-selected={section === t.key} onClick={() => setSection(t.key)}
            className="flex-1 py-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap px-3"
            style={{ background: section === t.key ? 'var(--bg-card)' : 'transparent', color: section === t.key ? 'var(--accent-dim)' : 'var(--text-dim)' }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══ ACCOUNT ═══ */}
      {section === 'account' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Fact icon={<UserRound size={18} aria-hidden="true" />} label="Name"><span>{fullName}</span></Fact>
            <Fact icon={<Mail size={18} aria-hidden="true" />} label="Email"><span className="break-all">{email}</span></Fact>
            <Fact icon={<CalendarDays size={18} aria-hidden="true" />} label="Member since"><span>{joined}</span></Fact>
            <Fact icon={<ProviderIcon provider={methods[0]} size={18} />} label="Sign-in method">
              <span className="flex flex-col gap-0.5">
                {methods.map((m) => <span key={m}>{PROVIDER_NAME[m] ?? m}</span>)}
              </span>
            </Fact>
          </div>
          <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
            These details are part of your account and cannot be edited here. To correct your name or email, contact support.
          </p>

          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Sign out</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>Sign out on this device.</p>
            <button onClick={handleSignOut} disabled={signingOut}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              <LogOut size={16} aria-hidden="true" />
              {signingOut ? 'Signing out...' : 'Sign out'}
            </button>
          </div>

          <div className="rounded-xl p-5" style={{ background: 'rgba(220,38,38,0.02)', border: '1px solid rgba(220,38,38,0.15)' }}>
            <h2 className="text-sm font-semibold mb-1 flex items-center gap-2" style={{ color: 'var(--error)' }}>
              <Trash2 size={16} aria-hidden="true" /> Delete account
            </h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
              Permanently deletes your account and personal data. If you have an active subscription, cancel it under Plan first. This cannot be undone.
            </p>
            <div className="flex flex-col gap-2">
              {hasPassword && (
                <input type="password" value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Your password" autoComplete="current-password" aria-label="Your password"
                  className="px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder='Type "DELETE" to confirm' aria-label="Type DELETE to confirm"
                  className="px-3.5 py-2.5 text-sm rounded-xl flex-1"
                  style={{ ...inputStyle, borderColor: deleteConfirm === 'DELETE' ? 'rgba(220,38,38,0.5)' : 'var(--border)' }} />
                <button onClick={handleDeleteAccount}
                  disabled={deleteConfirm !== 'DELETE' || deleting || (hasPassword && !deletePassword)}
                  className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-30 shrink-0"
                  style={{ background: 'rgba(220,38,38,0.1)', color: 'var(--error)', border: '1px solid rgba(220,38,38,0.3)' }}>
                  {deleting ? 'Deleting...' : 'Delete my account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ PROFILE ═══ */}
      {section === 'profile' && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Your journey</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>Ascentor uses this to personalise your coaching, sessions and goals.</p>

          <div className="flex flex-col gap-4">
            <Field label="What are you building?">
              <textarea value={form.what_building} onChange={(e) => setForm({ ...form, what_building: e.target.value })}
                placeholder="Describe what you are building with your life, not your job title."
                rows={3} className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none" style={inputStyle} />
            </Field>

            <Field label="Where are you in your ascent?">
              <div className="flex gap-2 flex-wrap">
                {ASCENT_STAGES.map((stage) => (
                  <button key={stage.value} type="button" aria-pressed={form.ascent_stage === stage.value}
                    onClick={() => setForm({ ...form, ascent_stage: stage.value })}
                    className="flex-1 px-3 py-2.5 rounded-xl text-left transition-all" style={{
                      minWidth: 100,
                      border: form.ascent_stage === stage.value ? '2px solid var(--accent)' : '1.5px solid var(--border)',
                      background: form.ascent_stage === stage.value ? 'rgba(200,169,110,0.08)' : 'var(--bg-input)',
                    }}>
                    <span style={{ display: 'block', fontSize: '0.8rem', fontWeight: 700, color: form.ascent_stage === stage.value ? 'var(--accent-dim)' : 'var(--text)', marginBottom: 2, fontFamily: 'var(--font-display)' }}>{stage.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-dim)' }}>{stage.sub}</span>
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Current role">
                <input value={form.current_role} onChange={(e) => setForm({ ...form, current_role: e.target.value })}
                  placeholder="e.g. Software Engineer" className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
              </Field>
              <Field label="Goal role">
                <input value={form.goal_role} onChange={(e) => setForm({ ...form, goal_role: e.target.value })}
                  placeholder="e.g. Engineering Manager" className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Industry">
                <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}>
                  <option value="">Select industry</option>
                  {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Daily commitment">
                <select value={form.time_commitment} onChange={(e) => setForm({ ...form, time_commitment: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}>
                  {timeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Biggest challenge">
              <textarea value={form.biggest_challenge} onChange={(e) => setForm({ ...form, biggest_challenge: e.target.value })}
                placeholder="What is your biggest professional challenge right now?"
                rows={3} className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none" style={inputStyle} />
            </Field>

            <div className="flex items-center gap-3">
              <button onClick={handleProfileSave} disabled={saving}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: '#0F0F0E' }}>
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              {saved && <span className="text-xs font-semibold animate-fade-up" style={{ color: 'var(--success)' }}>Changes saved</span>}
              {error && <span className="text-xs" style={{ color: 'var(--error)' }}>{error}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ SECURITY ═══ */}
      {section === 'security' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Password</h2>

            {!hasPassword ? (
              <div className="rounded-lg p-4 mt-3 flex items-center gap-3" style={{ background: 'var(--bg-input)', border: '1px solid var(--border)' }}>
                <ProviderIcon provider={methods[0]} size={20} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  You sign in with {PROVIDER_NAME[methods[0]] ?? 'your provider'}, so your password is managed there.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mt-3">
                <Field label="Current password">
                  <input type="password" value={passwords.current} autoComplete="current-password"
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
                </Field>
                <Field label="New password">
                  <input type="password" value={passwords.newPassword} autoComplete="new-password"
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    placeholder="At least 10 characters, mixed case, with a number"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
                </Field>
                <Field label="Confirm new password">
                  <input type="password" value={passwords.confirm} autoComplete="new-password"
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
                </Field>
                <button onClick={handlePasswordChange}
                  disabled={pwSaving || !passwords.current || !passwords.newPassword || !passwords.confirm}
                  className="w-fit px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: '#0F0F0E' }}>
                  {pwSaving ? 'Updating...' : 'Update password'}
                </button>
                {pwResult && <StatusBanner success={pwResult.success} message={pwResult.message} />}
                <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>
                  Changing your password keeps this device signed in and signs every other device out. Forgot it? Sign out and use &quot;Forgot your password?&quot; on the sign-in page.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Devices</h2>
            <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)' }}>
                <Monitor size={16} aria-hidden="true" />
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>This device</p>
                <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Active now</p>
              </div>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
            </div>
            <button onClick={handleSignOutAll} disabled={signingOutAll}
              className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ color: 'var(--error)', border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.04)' }}>
              {signingOutAll ? 'Signing out...' : 'Sign out of every device'}
            </button>
          </div>
        </div>
      )}

      {/* ═══ PLAN ═══ */}
      {section === 'plan' && <PlanTab profile={profile} />}

      {/* ═══ ALERTS ═══ */}
      {section === 'notifications' && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Email notifications</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>Choose what emails you receive from Ascentor.</p>
          <div className="flex flex-col gap-1">
            <Toggle label="Coaching session summaries" sub="Get a recap after each coaching session" checked={notifs.email_coaching_summary} onChange={(v) => setNotifs({ ...notifs, email_coaching_summary: v })} />
            <Toggle label="Weekly progress digest" sub="A summary of your goals, streaks, and activity" checked={notifs.email_weekly_digest} onChange={(v) => setNotifs({ ...notifs, email_weekly_digest: v })} />
            <Toggle label="Expert session reminders" sub="Get notified before upcoming live sessions" checked={notifs.email_expert_reminders} onChange={(v) => setNotifs({ ...notifs, email_expert_reminders: v })} />
            <Toggle label="Goal reminders" sub="Nudges to keep you on track with your 90-day goal" checked={notifs.email_goal_reminders} onChange={(v) => setNotifs({ ...notifs, email_goal_reminders: v })} />
            <Toggle label="Circle activity" sub="Posts and replies in The Circle" checked={notifs.email_community_activity} onChange={(v) => setNotifs({ ...notifs, email_community_activity: v })} />
            <Toggle label="Product updates & tips" sub="New features, tips, and announcements" checked={notifs.email_product_updates} onChange={(v) => setNotifs({ ...notifs, email_product_updates: v })} />
          </div>
          <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={handleNotifSave} disabled={notifSaving}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--accent)', color: '#0F0F0E' }}>
              {notifSaving ? 'Saving...' : 'Save preferences'}
            </button>
            {notifSaved && <span className="text-xs font-semibold animate-fade-up" style={{ color: 'var(--success)' }}>Saved</span>}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ PLAN TAB ═══

const PLAN_META: Record<string, { label: string; color: string; features: string[]; missing: string[] }> = {
  free:     { label: 'Free', color: '#7A7260', features: ['AI Coach (3 sessions/month)', '1 accountability circle', 'Goal tracking'], missing: ['Expert sessions', 'Courses & resources', 'Unlimited coaching'] },
  explorer: { label: 'Explorer', color: '#14B8A6', features: ['AI Coach (10 sessions/month)', '1 accountability circle', 'Courses & resources', 'Goal tracking (3 goals)', 'Weekly reflection prompts'], missing: ['Live expert sessions', 'Priority support'] },
  builder:  { label: 'Builder', color: '#A8894E', features: ['AI Coach (unlimited)', 'Up to 3 accountability circles', 'Live expert sessions', 'Human mentor matching', 'Courses & resources', 'Priority support'], missing: ['1-on-1 quarterly expert session', 'Executive peer circle'] },
  climber:  { label: 'Climber', color: '#8B5CF6', features: ['AI Coach (unlimited + priority)', 'Unlimited accountability circles', '1-on-1 expert session (quarterly)', 'Executive peer circle', 'Advanced analytics', 'Team dashboard (10 seats)', 'Dedicated account manager'], missing: [] },
  standard: { label: 'Builder', color: '#A8894E', features: ['AI Coach (unlimited)', 'Up to 3 circles', 'Courses & resources', 'Priority support'], missing: [] },
  tester:   { label: 'Tester', color: '#A8894E', features: ['Full access (beta tester)', 'All Builder features included'], missing: [] },
  pro:      { label: 'Pro', color: '#8B5CF6', features: ['Full access', 'All features included'], missing: [] },
};

function PlanTab({ profile }: { profile: any }) {
  const plan: string = profile?.subscription_plan || 'free';
  const status: string | undefined = profile?.subscription_status;
  const isActive = ['active', 'trialing'].includes(status ?? '') && (!profile?.subscription_end || new Date(profile.subscription_end) > new Date());
  const meta = PLAN_META[plan] || PLAN_META.free;
  const statusLabel = !isActive ? 'Free tier' : status === 'trialing' ? 'Trial' : 'Active';
  const statusColor = !isActive ? 'var(--accent-dim)' : 'var(--success)';
  const statusBg = !isActive ? 'rgba(200,169,110,0.09)' : 'rgba(16,185,129,0.09)';

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: `1px solid ${meta.color}40` }}>
        <div className="flex justify-between items-start mb-3">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Current plan</span>
            <h2 className="text-lg font-bold mt-0.5" style={{ fontFamily: 'var(--font-display)', color: meta.color }}>{meta.label}</h2>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ background: statusBg, color: statusColor }}>{statusLabel}</span>
        </div>

        <div className="flex flex-col gap-1.5 mb-2">
          {meta.features.map((f) => (
            <div key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
              <span style={{ color: 'var(--success)' }}><Check size={13} aria-hidden="true" /></span>
              <span>{f}</span>
            </div>
          ))}
        </div>
        {meta.missing.length > 0 && (
          <div className="flex flex-col gap-1.5 mb-4 mt-1">
            {meta.missing.map((f) => <div key={f} className="text-xs" style={{ color: 'var(--text-dim)', opacity: 0.6 }}>Not included: {f}</div>)}
          </div>
        )}

        {(!isActive || ['free', 'explorer', 'builder'].includes(plan)) && plan !== 'climber' && (
          <a href="/checkout" className="block w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-all mt-4" style={{ background: meta.color, color: '#FFFFFF' }}>
            {!isActive ? (plan === 'free' ? 'Choose a plan' : 'Reactivate plan') : `Upgrade to ${plan === 'explorer' ? 'Builder' : 'Climber'}`}
          </a>
        )}
      </div>

      <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Billing</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
          {['active', 'trialing'].includes(status ?? '') ? 'Your subscription renews automatically.'
            : status === 'cancelled' ? 'Subscription cancelled, no future charges.'
            : 'No active subscription. Upgrade to access all features.'}
        </p>
        {['active', 'trialing', 'cancelled'].includes(status ?? '') && (
          <div className="flex flex-col gap-2">
            {profile?.subscription_end && (
              <InfoRow label={status === 'cancelled' ? 'Access until' : 'Next billing date'}
                value={new Date(profile.subscription_end).toLocaleDateString('en-NG', { month: 'long', day: 'numeric', year: 'numeric' })} />
            )}
            {profile?.billing_cycle && <InfoRow label="Billing cycle" value={profile.billing_cycle === 'annual' ? 'Annual' : 'Monthly'} />}
            {(() => {
              const card = profile?.card_details;
              if (card?.last4) {
                const brand = (card.card_type || card.channel || 'Card').replace(/^\w/, (c: string) => c.toUpperCase());
                const expiry = card.exp_month && card.exp_year ? ` · ${card.exp_month}/${card.exp_year}` : '';
                return <InfoRow label="Payment method" value={`${brand} ending ${card.last4}${expiry}`} />;
              }
              return profile?.payment_method ? <InfoRow label="Payment method" value={profile.payment_method} /> : null;
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══ SHARED COMPONENTS ═══

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  outline: 'none',
};

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl p-4 flex items-start gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <span style={{ color: 'var(--accent-dim)', marginTop: 2 }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide" style={{ color: 'var(--text-dim)' }}>{label}</p>
        <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold mb-1.5 block uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>{label}</label>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
      <span className="text-xs" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{value}</span>
    </div>
  );
}

function Toggle({ label, sub, checked, onChange }: { label: string; sub: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex-1 pr-4">
        <p className="text-sm" style={{ color: 'var(--text)' }}>{label}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{sub}</p>
      </div>
      <button role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full transition-all shrink-0 relative"
        style={{ background: checked ? 'var(--accent)' : 'var(--bg-input)', border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}` }}>
        <div className="w-3.5 h-3.5 rounded-full transition-all absolute top-0.5" style={{ background: checked ? '#0F0F0E' : 'var(--text-dim)', left: checked ? '20px' : '3px' }} />
      </button>
    </div>
  );
}

function StatusBanner({ success, message }: { success?: boolean; message: string }) {
  return (
    <div role="status" className="rounded-lg p-3" style={{
      background: success ? 'rgba(16,185,129,0.06)' : 'rgba(220,38,38,0.06)',
      border: `1px solid ${success ? 'rgba(16,185,129,0.2)' : 'rgba(220,38,38,0.2)'}`,
    }}>
      <p className="text-xs" style={{ color: success ? 'var(--success)' : 'var(--error)' }}>{message}</p>
    </div>
  );
}
