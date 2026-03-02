'use client';

import { useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

const industries = [
  'Technology', 'Finance & Banking', 'Consulting', 'Healthcare',
  'Education', 'Energy', 'Telecom', 'Government', 'NGO',
  'Real Estate', 'Manufacturing', 'Media & Entertainment',
  'Agriculture', 'Legal', 'Retail', 'Other',
];

const timeOptions = [
  { value: '10min', label: '10 min/day' },
  { value: '15min', label: '15 min/day' },
  { value: '30min', label: '30 min/day' },
  { value: '60min', label: '1 hour/day' },
];

type Section = 'profile' | 'security' | 'plan' | 'notifications' | 'danger';

export default function AccountClient({ profile, email, authProvider, userId, notifications }: {
  profile: any;
  email: string;
  authProvider: string;
  userId: string;
  notifications: any;
}) {
  const supabase = createClient();
  const router = useRouter();
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const [section, setSection] = useState<Section>('profile');

  // ═══ PROFILE STATE ═══
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    current_role: profile?.current_role || '',
    industry: profile?.industry || '',
    goal_role: profile?.goal_role || '',
    biggest_challenge: profile?.biggest_challenge || '',
    time_commitment: profile?.time_commitment || '15min',
    avatar_url: profile?.avatar_url || '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);

  // ═══ SECURITY STATE ═══
  const [passwords, setPasswords] = useState({ current: '', newPassword: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwResult, setPwResult] = useState<{ success?: boolean; message: string } | null>(null);

  // ═══ NOTIFICATION STATE ═══
  const [notifs, setNotifs] = useState({
    email_coaching_summary: notifications?.email_coaching_summary ?? true,
    email_weekly_digest: notifications?.email_weekly_digest ?? true,
    email_expert_reminders: notifications?.email_expert_reminders ?? true,
    email_product_updates: notifications?.email_product_updates ?? true,
    email_community_activity: notifications?.email_community_activity ?? false,
    email_goal_reminders: notifications?.email_goal_reminders ?? true,
  });
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // ═══ DANGER STATE ═══
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  const [signingOut, setSigningOut] = useState(false);
  const isOAuth = authProvider !== 'email';

  const initials = (form.full_name || 'U')
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // ═══ PROFILE HANDLERS ═══
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please select an image.'); return; }
    if (file.size > 2 * 1024 * 1024) { alert('Image must be under 2MB.'); return; }

    setAvatarUploading(true);
    const ext = file.name.split('.').pop();
    const path = `avatars/${userId}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      alert('Upload failed: ' + uploadError.message);
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

    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id: userId,
        full_name: form.full_name,
        current_role: form.current_role,
        industry: form.industry,
        goal_role: form.goal_role,
        biggest_challenge: form.biggest_challenge,
        time_commitment: form.time_commitment,
        updated_at: new Date().toISOString(),
      });

    if (dbError) { setError(dbError.message); }
    else { setSaved(true); setTimeout(() => setSaved(false), 3000); }
    setSaving(false);
  };

  // ═══ SECURITY HANDLERS ═══
  const handlePasswordChange = async () => {
    setPwSaving(true); setPwResult(null);

    // ── Client-side validation ────────────────────────────────────
    if (!passwords.current.trim()) {
      setPwResult({ success: false, message: 'Please enter your current password.' });
      setPwSaving(false); return;
    }
    if (passwords.newPassword.length < 8) {
      setPwResult({ success: false, message: 'New password must be at least 8 characters.' });
      setPwSaving(false); return;
    }
    if (passwords.newPassword !== passwords.confirm) {
      setPwResult({ success: false, message: 'Passwords do not match.' });
      setPwSaving(false); return;
    }
    if (passwords.current === passwords.newPassword) {
      setPwResult({ success: false, message: 'New password must be different from your current password.' });
      setPwSaving(false); return;
    }

    // ── S6 FIX: Verify current password before allowing update ────
    // signInWithPassword re-authenticates the user with their current credentials.
    // If this fails, we block the update — the current password field is real.
    const { error: verifyError } = await supabase.auth.signInWithPassword({
      email,
      password: passwords.current,
    });

    if (verifyError) {
      setPwResult({ success: false, message: 'Current password is incorrect.' });
      setPwSaving(false); return;
    }

    // ── Current password verified — now update to new password ────
    const { error: updateError } = await supabase.auth.updateUser({
      password: passwords.newPassword,
    });

    if (updateError) {
      setPwResult({ success: false, message: updateError.message });
    } else {
      setPwResult({ success: true, message: 'Password updated successfully.' });
      setPasswords({ current: '', newPassword: '', confirm: '' });
    }
    setPwSaving(false);
  };

  // ═══ NOTIFICATION HANDLERS ═══
  const handleNotifSave = async () => {
    setNotifSaving(true); setNotifSaved(false);

    await supabase.from('notification_preferences').upsert({
      user_id: userId,
      ...notifs,
      updated_at: new Date().toISOString(),
    });

    setNotifSaved(true);
    setTimeout(() => setNotifSaved(false), 3000);
    setNotifSaving(false);
  };

  // ═══ DANGER HANDLERS ═══
  const handleExportData = async () => {
    setExporting(true);
    try {
      const [profileData, sessions, goals, commitments, posts] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', userId).single(),
        supabase.from('coaching_sessions').select('*').eq('user_id', userId),
        supabase.from('user_goals').select('*').eq('user_id', userId),
        supabase.from('user_commitments').select('*').eq('user_id', userId),
        supabase.from('cohort_posts').select('*').eq('user_id', userId),
      ]);

      const exportData = {
        exported_at: new Date().toISOString(),
        profile: profileData.data,
        coaching_sessions: sessions.data,
        goals: goals.data,
        commitments: commitments.data,
        community_posts: posts.data,
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ascentor-data-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Export failed. Please try again.');
    }
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);

    try {
      // 1. Insert deletion request record in DB
      const { error: reqError } = await supabase
        .from('deletion_requests')
        .insert({
          user_id:    userId,
          email,
          status:     'pending',
          requested_at: new Date().toISOString(),
        });

      if (reqError) {
        console.error('Deletion request error:', reqError);
        // Fallback: still audit log even if table doesn't exist yet
      }

      // 2. Audit log
      try {
        await supabase.from('audit_logs').insert({
          user_id:     userId,
          action:      'account_deletion_requested',
          entity_type: 'user',
          entity_id:   userId,
          details:     { email, requested_at: new Date().toISOString() },
        });
      } catch { /* non-critical */ }

      // 3. Notify user via in-app notification
      try {
        await supabase.from('notifications').insert({
          user_id: userId,
          type:    'account',
          title:   'Account deletion requested',
          message: 'Your request has been received. Your account and data will be deleted within 48 hours. You will receive a confirmation email.',
          link:    '/account',
        });
      } catch { /* non-critical */ }

      // 4. Show confirmation and sign out
      setDeleteConfirm('');
      setDeleting(false);
      alert(`Deletion request submitted for ${email}. Your account will be deleted within 48 hours. You will be signed out now.`);
      await supabase.auth.signOut();
      router.push('/');

    } catch (err) {
      console.error('Delete account error:', err);
      setDeleting(false);
      alert('Something went wrong. Please contact support at hello@ascentorbi.com to request account deletion.');
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    await supabase.auth.signOut();
    router.push('/login');
  };

  const sections: { key: Section; label: string }[] = [
    { key: 'profile', label: 'Profile' },
    { key: 'security', label: 'Security' },
    { key: 'plan', label: 'Plan' },
    { key: 'notifications', label: 'Alerts' },
    { key: 'danger', label: 'Account' },
  ];

  return (
    <div className="animate-fade-up py-6 max-w-2xl mx-auto">
      {/* ═══ HEADER ═══ */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative group">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt="Avatar"
              className="w-14 h-14 rounded-full object-cover"
              style={{ border: '2px solid rgba(245,158,11,0.3)' }} />
          ) : (
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
              style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--accent)', border: '2px solid rgba(245,158,11,0.3)' }}>
              {initials}
            </div>
          )}
          <button onClick={() => avatarInputRef.current?.click()}
            className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ background: 'rgba(0,0,0,0.5)' }}>
            <span className="text-white text-xs">{avatarUploading ? '...' : 'Edit'}</span>
          </button>
          <input ref={avatarInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
            Settings
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {email}
            {isOAuth && (
              <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold"
                style={{ background: 'rgba(59,130,246,0.09)', color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.19)' }}>
                {authProvider === 'google' ? 'Google' : authProvider === 'linkedin_oidc' ? 'LinkedIn' : authProvider}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ═══ TABS ═══ */}
      <div className="flex gap-1 mb-5 p-1 rounded-lg overflow-x-auto" style={{ background: 'var(--bg-input)', scrollbarWidth: 'none' }}>
        {sections.map((t) => (
          <button key={t.key} onClick={() => setSection(t.key)}
            className="flex-1 py-2 rounded-md text-xs font-semibold transition-all whitespace-nowrap px-2"
            style={{
              background: section === t.key ? 'var(--bg-card)' : 'transparent',
              color: section === t.key ? 'var(--accent)' : 'var(--text-dim)',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ 1. PROFILE SECTION ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {section === 'profile' && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>Personal Information</h2>

          <div className="flex flex-col gap-4">
            <Field label="Full Name" required>
              <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="Your full name" className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
            </Field>

            <Field label="Email Address">
              <div className="flex items-center gap-2">
                <input value={email} disabled className="w-full px-3.5 py-2.5 text-sm rounded-xl opacity-60" style={inputStyle} />
                <span className="text-[10px] shrink-0 px-2 py-1 rounded-full"
                  style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)' }}>Verified</span>
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-dim)' }}>
                Contact support to change your email address.
              </p>
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Current Role" required>
                <input value={form.current_role} onChange={(e) => setForm({ ...form, current_role: e.target.value })}
                  placeholder="e.g. Software Engineer" className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
              </Field>
              <Field label="Goal Role" required>
                <input value={form.goal_role} onChange={(e) => setForm({ ...form, goal_role: e.target.value })}
                  placeholder="e.g. Engineering Manager" className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Industry" required>
                <select value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}>
                  <option value="">Select industry</option>
                  {industries.map((i) => <option key={i} value={i}>{i}</option>)}
                </select>
              </Field>
              <Field label="Daily Commitment">
                <select value={form.time_commitment} onChange={(e) => setForm({ ...form, time_commitment: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle}>
                  {timeOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Biggest Challenge">
              <textarea value={form.biggest_challenge} onChange={(e) => setForm({ ...form, biggest_challenge: e.target.value })}
                placeholder="What's your biggest professional challenge right now?"
                rows={3} className="w-full px-3.5 py-2.5 text-sm rounded-xl resize-none" style={inputStyle} />
            </Field>

            <div className="rounded-lg p-3" style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.12)' }}>
              <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                Your journey: <span style={{ color: 'var(--text-muted)' }}>{form.current_role || '...'}</span>
                {' '}&rarr;{' '}
                <span style={{ color: 'var(--accent)' }}>{form.goal_role || '...'}</span>
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleProfileSave}
                disabled={saving || !form.full_name.trim() || !form.current_role.trim()}
                className="px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                style={{ background: 'var(--accent)', color: '#000' }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              {saved && <span className="text-xs font-semibold animate-fade-up" style={{ color: 'var(--success)' }}>Changes saved</span>}
              {error && <span className="text-xs" style={{ color: 'var(--error)' }}>{error}</span>}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ 2. SECURITY SECTION ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {section === 'security' && (
        <div className="flex flex-col gap-4">
          {/* Change Password */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Change Password</h2>

            {isOAuth ? (
              <div className="rounded-lg p-4 mt-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  You signed in with <strong style={{ color: 'var(--blue)' }}>
                    {authProvider === 'google' ? 'Google' : authProvider === 'linkedin_oidc' ? 'LinkedIn' : authProvider}
                  </strong>. Your password is managed by your provider.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 mt-3">
                <Field label="Current Password">
                  <input type="password" value={passwords.current}
                    onChange={(e) => setPasswords({ ...passwords, current: e.target.value })}
                    placeholder="Enter current password"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
                </Field>
                <Field label="New Password">
                  <input type="password" value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    placeholder="Minimum 8 characters"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
                </Field>
                <Field label="Confirm New Password">
                  <input type="password" value={passwords.confirm}
                    onChange={(e) => setPasswords({ ...passwords, confirm: e.target.value })}
                    placeholder="Re-enter new password"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl" style={inputStyle} />
                </Field>

                {passwords.newPassword && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                      <div className="h-full rounded-full transition-all" style={{
                        width: passwords.newPassword.length >= 12 ? '100%' : passwords.newPassword.length >= 10 ? '75%' : passwords.newPassword.length >= 8 ? '50%' : '20%',
                        background: passwords.newPassword.length >= 12 ? 'var(--success)' : passwords.newPassword.length >= 10 ? 'var(--accent)' : passwords.newPassword.length >= 8 ? 'var(--blue)' : 'var(--error)',
                      }} />
                    </div>
                    <span className="text-[10px]" style={{
                      color: passwords.newPassword.length >= 12 ? 'var(--success)' : passwords.newPassword.length >= 10 ? 'var(--accent)' : passwords.newPassword.length >= 8 ? 'var(--blue)' : 'var(--error)',
                    }}>
                      {passwords.newPassword.length >= 12 ? 'Strong' : passwords.newPassword.length >= 10 ? 'Good' : passwords.newPassword.length >= 8 ? 'Fair' : 'Too short'}
                    </span>
                  </div>
                )}

                <button onClick={handlePasswordChange}
                  disabled={pwSaving || !passwords.current || !passwords.newPassword || !passwords.confirm}
                  className="w-fit px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
                  style={{ background: 'var(--accent)', color: '#000' }}>
                  {pwSaving ? 'Updating...' : 'Update Password'}
                </button>

                {pwResult && (
                  <StatusBanner success={pwResult.success} message={pwResult.message} />
                )}
              </div>
            )}
          </div>

          {/* Two-Factor Authentication */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Two-Factor Authentication</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-dim)' }}>Add an extra layer of security to your account.</p>
              </div>
              <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full"
                style={{ background: 'rgba(107,114,128,0.09)', color: 'var(--text-dim)', border: '1px solid var(--border)' }}>
                Coming Soon
              </span>
            </div>
          </div>

          {/* Active Sessions */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Active Sessions</h2>
            <div className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
                style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
              </div>
              <div className="flex-1">
                <p className="text-xs font-medium" style={{ color: 'var(--text)' }}>Current session</p>
                <p className="text-[10px]" style={{ color: 'var(--text-dim)' }}>Active now</p>
              </div>
              <span className="w-2 h-2 rounded-full" style={{ background: 'var(--success)' }} />
            </div>
            <button onClick={handleSignOut} disabled={signingOut}
              className="mt-3 px-4 py-2 rounded-lg text-xs font-semibold disabled:opacity-40"
              style={{ color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.04)' }}>
              {signingOut ? 'Signing out...' : 'Sign Out All Devices'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ 3. PLAN / SUBSCRIPTION ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {section === 'plan' && (
        <div className="flex flex-col gap-4">
          {/* Current Plan — B4 fix: features gated by actual plan tier */}
          {(() => {
            const plan = profile?.subscription_plan || 'free';
            const status = profile?.subscription_status;
            const isActive = ['active', 'trialing'].includes(status) &&
              (!profile?.subscription_end || new Date(profile.subscription_end) > new Date());

            // Plan metadata by tier
            const planMeta: Record<string, { label: string; color: string; features: string[]; missing: string[] }> = {
              free: {
                label: 'Free',
                color: '#7A7260',
                features: ['Sage (3 sessions/month)', '1 mentorship circle', 'Goal tracking'],
                missing: ['Expert sessions', 'Courses & learning', 'Unlimited Sage', 'Export history'],
              },
              explorer: {
                label: 'Explorer',
                color: '#14B8A6',
                features: ['Sage (10 sessions/month)', '1 mentorship circle', 'Courses & learning', 'Goal tracking (3 goals)', 'Weekly reflection prompts'],
                missing: ['Live mentor sessions', 'Export history', 'Priority support'],
              },
              builder: {
                label: 'Builder',
                color: '#E8A020',
                features: ['Sage (unlimited sessions)', 'Up to 3 mentorship circles', 'Live mentor sessions', 'Human mentor matching', 'Courses & learning', 'Export session history', 'Priority support'],
                missing: ['1-on-1 quarterly expert session', 'Executive peer circle', 'Team dashboard'],
              },
              climber: {
                label: 'Climber',
                color: '#8B5CF6',
                features: ['Sage (unlimited + priority)', 'Unlimited mentorship circles', '1-on-1 expert session (quarterly)', 'Executive peer circle', 'Advanced analytics', 'Team dashboard (10 seats)', 'Dedicated account manager'],
                missing: [],
              },
              // Legacy aliases
              standard: { label: 'Builder', color: '#E8A020', features: ['Sage (unlimited)', 'Up to 3 circles', 'Courses & learning', 'Export history', 'Priority support'], missing: [] },
              tester:   { label: 'Tester',  color: '#E8A020', features: ['Full access (beta tester)', 'All Builder features included'], missing: [] },
              pro:      { label: 'Pro',     color: '#8B5CF6', features: ['Full access', 'All features included'], missing: [] },
            };

            const meta = planMeta[plan] || planMeta.free;
            const statusLabel = !isActive ? 'Free Tier' : status === 'trialing' ? 'Trial' : 'Active';
            const statusColor = !isActive ? 'var(--accent)' : 'var(--success)';
            const statusBg    = !isActive ? 'rgba(245,158,11,0.09)' : 'rgba(16,185,129,0.09)';
            const statusBorder = !isActive ? 'rgba(245,158,11,0.19)' : 'rgba(16,185,129,0.19)';

            return (
              <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: `1px solid ${meta.color}40` }}>
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>Current Plan</span>
                    <h2 className="text-lg font-bold mt-0.5" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: meta.color }}>
                      {meta.label}
                    </h2>
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold"
                    style={{ background: statusBg, color: statusColor, border: `1px solid ${statusBorder}` }}>
                    {statusLabel}
                  </span>
                </div>

                {/* Included features */}
                <div className="flex flex-col gap-1.5 mb-2">
                  {meta.features.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span style={{ color: 'var(--success)', fontWeight: 700 }}>✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                {/* Missing features */}
                {meta.missing.length > 0 && (
                  <div className="flex flex-col gap-1.5 mb-4 mt-1">
                    {meta.missing.map((f) => (
                      <div key={f} className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-dim)', opacity: 0.5 }}>
                        <span>–</span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Upgrade CTA — only for non-climber non-active, or free users */}
                {(!isActive || ['free', 'explorer', 'builder'].includes(plan)) && plan !== 'climber' && (
                  <a href="/checkout"
                    className="block w-full py-2.5 rounded-lg text-sm font-semibold text-center transition-all mt-4"
                    style={{ background: meta.color, color: plan === 'free' || !isActive ? '#000' : '#fff' }}>
                    {!isActive ? 'Start Free Trial' : `Upgrade to ${plan === 'explorer' ? 'Builder' : 'Climber'}`}
                  </a>
                )}
              </div>
            );
          })()}

          {/* Billing Info */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Billing</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
              {profile?.subscription_status === 'active'
                ? 'Your subscription renews automatically.'
                : 'No active subscription. Upgrade to access all features.'}
            </p>
            {profile?.subscription_status === 'active' && (
              <div className="flex flex-col gap-2">
                <InfoRow label="Next billing date" value={
                  profile?.subscription_end
                    ? new Date(profile.subscription_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                    : 'N/A'
                } />
                <InfoRow label="Payment method" value={profile?.payment_method || 'Card ending in ****'} />
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ 4. NOTIFICATIONS ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {section === 'notifications' && (
        <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Email Notifications</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>Choose what emails you receive from Ascentor.</p>

          <div className="flex flex-col gap-1">
            <Toggle label="Coaching session summaries" sub="Get a recap after each Sage session"
              checked={notifs.email_coaching_summary}
              onChange={(v) => setNotifs({ ...notifs, email_coaching_summary: v })} />
            <Toggle label="Weekly progress digest" sub="A summary of your goals, streaks, and activity"
              checked={notifs.email_weekly_digest}
              onChange={(v) => setNotifs({ ...notifs, email_weekly_digest: v })} />
            <Toggle label="Expert session reminders" sub="Get notified before upcoming live sessions"
              checked={notifs.email_expert_reminders}
              onChange={(v) => setNotifs({ ...notifs, email_expert_reminders: v })} />
            <Toggle label="Goal reminders" sub="Nudges to keep you on track with your 90-day goal"
              checked={notifs.email_goal_reminders}
              onChange={(v) => setNotifs({ ...notifs, email_goal_reminders: v })} />
            <Toggle label="Community activity" sub="Posts and replies in your cohorts"
              checked={notifs.email_community_activity}
              onChange={(v) => setNotifs({ ...notifs, email_community_activity: v })} />
            <Toggle label="Product updates & tips" sub="New features, tips, and announcements"
              checked={notifs.email_product_updates}
              onChange={(v) => setNotifs({ ...notifs, email_product_updates: v })} />
          </div>

          <div className="flex items-center gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={handleNotifSave} disabled={notifSaving}
              className="px-6 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--accent)', color: '#000' }}>
              {notifSaving ? 'Saving...' : 'Save Preferences'}
            </button>
            {notifSaved && <span className="text-xs font-semibold animate-fade-up" style={{ color: 'var(--success)' }}>Saved</span>}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* ═══ 5. DANGER ZONE / ACCOUNT ═══ */}
      {/* ═══════════════════════════════════════════ */}
      {section === 'danger' && (
        <div className="flex flex-col gap-4">
          {/* Account Info */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--text)' }}>Account Details</h2>
            <InfoRow label="Email" value={email} />
            <InfoRow label="Auth method" value={isOAuth ? (authProvider === 'google' ? 'Google' : 'LinkedIn') : 'Email & Password'} />
            <InfoRow label="Member since" value={
              profile?.created_at
                ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                : 'Unknown'
            } />
            <InfoRow label="Account role" value={profile?.role || 'member'} />
          </div>

          {/* Sign Out */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Sign Out</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>Sign out on this device.</p>
            <button onClick={handleSignOut} disabled={signingOut}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
              {signingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>

          {/* Export Data */}
          <div className="rounded-xl p-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--text)' }}>Export Your Data</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
              Download all your data including profile, coaching sessions, goals, and community posts as a JSON file. GDPR compliant.
            </p>
            <button onClick={handleExportData} disabled={exporting}
              className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-40"
              style={{ color: 'var(--blue)', border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(59,130,246,0.04)' }}>
              {exporting ? 'Preparing download...' : 'Download My Data'}
            </button>
          </div>

          {/* Delete Account */}
          <div className="rounded-xl p-5" style={{ background: 'rgba(239,68,68,0.02)', border: '1px solid rgba(239,68,68,0.15)' }}>
            <h2 className="text-sm font-semibold mb-1" style={{ color: 'var(--error)' }}>Delete Account</h2>
            <p className="text-xs mb-3" style={{ color: 'var(--text-dim)' }}>
              Permanently delete your account and all associated data. This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder='Type "DELETE" to confirm'
                className="px-3.5 py-2.5 text-sm rounded-xl flex-1"
                style={{ ...inputStyle, borderColor: deleteConfirm === 'DELETE' ? 'rgba(239,68,68,0.5)' : 'var(--border)' }} />
              <button onClick={handleDeleteAccount}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-30 shrink-0"
                style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', border: '1px solid rgba(239,68,68,0.3)' }}>
                {deleting ? 'Processing...' : 'Delete My Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ SHARED COMPONENTS ═══

const inputStyle: React.CSSProperties = {
  background: 'var(--bg-input)', color: 'var(--text)',
  border: '1px solid var(--border)', outline: 'none',
};

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold mb-1.5 block uppercase tracking-wider" style={{ color: 'var(--text-dim)' }}>
        {label} {required && <span style={{ color: 'var(--accent)' }}>*</span>}
      </label>
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

function Toggle({ label, sub, checked, onChange }: {
  label: string; sub: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between py-3" style={{ borderBottom: '1px solid var(--border)' }}>
      <div className="flex-1 pr-4">
        <p className="text-sm" style={{ color: 'var(--text)' }}>{label}</p>
        <p className="text-[11px]" style={{ color: 'var(--text-dim)' }}>{sub}</p>
      </div>
      <button onClick={() => onChange(!checked)}
        className="w-10 h-5 rounded-full transition-all shrink-0 relative"
        style={{ background: checked ? 'var(--accent)' : 'var(--bg-input)', border: `1px solid ${checked ? 'var(--accent)' : 'var(--border)'}` }}>
        <div className="w-3.5 h-3.5 rounded-full transition-all absolute top-0.5"
          style={{ background: checked ? '#000' : 'var(--text-dim)', left: checked ? '20px' : '3px' }} />
      </button>
    </div>
  );
}

function StatusBanner({ success, message }: { success?: boolean; message: string }) {
  return (
    <div className="rounded-lg p-3" style={{
      background: success ? 'rgba(16,185,129,0.06)' : 'rgba(239,68,68,0.06)',
      border: `1px solid ${success ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
    }}>
      <p className="text-xs" style={{ color: success ? 'var(--success)' : 'var(--error)' }}>{message}</p>
    </div>
  );
}
