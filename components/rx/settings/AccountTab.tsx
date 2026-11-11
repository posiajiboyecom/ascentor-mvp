'use client';

// Settings > Account: who you are, change email, language and time zone, your data, sign out, delete account.

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarDays, KeyRound, LogOut, Mail, Trash2, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { confirmAction } from '@/components/Modal';
import { useToast } from '@/components/rx/Toast';
import { LanguageSelect, TimezoneSelect } from '@/components/rx/settings/SettingsClient';
import { signOutAndLeave } from '@/lib/auth/sign-out';

const PROVIDER: Record<string, string> = { google: 'Google', linkedin_oidc: 'LinkedIn', linkedin: 'LinkedIn', email: 'Email and password' };

export default function AccountTab({ name, email, memberSince, methods, hasPassword, language, timezoneLabel }: {
  name: string; email: string; memberSince: string; methods: string[]; hasPassword: boolean; language: string; timezoneLabel: string;
}) {
  const toast = useToast();
  const [signingOut, setSigningOut] = useState(false);
  const [delTxt, setDelTxt] = useState('');
  const [delPw, setDelPw] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<{ message: string; code?: string } | null>(null);

  const delOk = delTxt.trim() === 'DELETE';

  const signOut = async () => {
    if (!(await confirmAction('Sign out of Ascentor on this device?', { title: 'Sign out?', confirmLabel: 'Sign out' }))) return;
    setSigningOut(true);
    await signOutAndLeave('/');
  };

  const deleteAccount = async () => {
    if (!delOk) { toast('Type DELETE to confirm.'); return; }
    if (hasPassword && !delPw) { setDelErr({ message: 'Enter your password to delete your account.' }); return; }
    const ok = await confirmAction(
      'This permanently deletes your account, goals, commitments, coaching sessions and messages. It cannot be undone.',
      { title: 'Delete your account?', confirmLabel: 'Delete permanently' },
    );
    if (!ok) return;
    setDeleting(true); setDelErr(null);
    try {
      const res = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE', ...(hasPassword ? { password: delPw } : {}) }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDelErr({ message: result.error || 'Something went wrong. Please try again.', code: result.code });
        setDeleting(false);
        return;
      }
      await createClient().auth.signOut().catch(() => undefined);
      window.location.assign('/');
    } catch {
      setDelErr({ message: 'We could not reach the server. Nothing was deleted. Please try again.' });
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="rx-grid2">
        <div className="rx-ifo"><UserRound aria-hidden /><div style={{ minWidth: 0 }}><p className="k">Name</p><p className="v">{name}</p></div></div>
        <div className="rx-ifo"><Mail aria-hidden /><div style={{ minWidth: 0 }}><p className="k">Email</p><p className="v">{email}</p></div></div>
        <div className="rx-ifo"><CalendarDays aria-hidden /><div style={{ minWidth: 0 }}><p className="k">Member since</p><p className="v">{memberSince}</p></div></div>
        <div className="rx-ifo"><KeyRound aria-hidden /><div style={{ minWidth: 0 }}><p className="k">Sign-in method</p><p className="v">{methods.map((m) => PROVIDER[m] ?? m).join(', ')}</p></div></div>
      </div>
      <p className="rx-sm">
        To change your name, go to <Link href="/settings?tab=profile" scroll={false} className="rx-link" style={{ minHeight: 0, display: 'inline' }}>Profile</Link>.
        {!methods.includes('email') && ' Your email comes from the account you sign in with, so it changes there.'}
      </p>

      {methods.includes('email') && <ChangeEmail current={email} />}

      <div className="rx-card st">
        <p className="rx-sl">Language and time zone</p>
        <div className="rx-fld">
          <span className="rx-fld-label">Language you’re most comfortable in</span>
          <LanguageSelect value={language} />
          <p className="rx-sm">Used to match you with a Circle and for announcements. The app itself stays in English.</p>
        </div>
        <div className="rx-fld"><span className="rx-fld-label">Time zone</span><TimezoneSelect label={timezoneLabel} /></div>
      </div>

      <div className="rx-card st">
        <p className="rx-sl">Your data</p>
        <p className="rx-p">Download a copy of your profile, check-ins, posts and messages.</p>
        <div><a href="/api/rx/export" className="rx-btn secondary" download>Export my data</a></div>
      </div>

      <div className="rx-card st">
        <div><p className="rx-h3">Sign out</p><p className="rx-sm">Sign out on this device.</p></div>
        <div className="rx-row">
          <button type="button" className="rx-btn secondary" onClick={signOut} disabled={signingOut}><LogOut aria-hidden style={{ width: 16, height: 16 }} />{signingOut ? 'Signing out...' : 'Sign out'}</button>
          <Link href="/settings?tab=security" scroll={false} className="rx-link">Manage other devices<ArrowRight aria-hidden /></Link>
        </div>
      </div>

      <div className="rx-card st danger">
        <div className="rx-row rx-nw" style={{ gap: 10, color: 'var(--rx-danger)' }}><Trash2 aria-hidden style={{ width: 20, height: 20 }} /><p className="rx-h3">Delete account</p></div>
        <p className="rx-p">Permanently deletes your account and personal data, including what Sage knows and your check-ins. If you have an active subscription, cancel it under Billing first. This can’t be undone.</p>
        {hasPassword && (
          <div className="rx-fld"><label htmlFor="delpw">Your password</label><input id="delpw" type="password" className="rx-in" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></div>
        )}
        <div className="rx-fld"><label htmlFor="delc">Type DELETE to confirm</label><input id="delc" className="rx-in" placeholder="DELETE" value={delTxt} onChange={(e) => setDelTxt(e.target.value)} /></div>
        {delErr && (
          <div className="rx-banner err" role="alert">
            <div>{delErr.message}{delErr.code === 'subscription_active' && <> <Link href="/settings/billing" style={{ color: 'inherit', fontWeight: 600 }}>Go to Billing</Link></>}</div>
          </div>
        )}
        <div><button type="button" className={`rx-btn ${delOk ? 'bdanger' : 'bmuted'}`} aria-disabled={!delOk || deleting} onClick={deleteAccount}>{deleting ? 'Deleting...' : 'Delete my account'}</button></div>
      </div>
    </>
  );
}

/** Email change through Supabase: a confirmation link goes to the new address (and, with secure email change, the old one). */
function ChangeEmail({ current }: { current: string }) {
  const [open, setOpen] = useState(false);
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const submit = async () => {
    const addr = next.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(addr)) { setMsg({ ok: false, text: 'Enter a valid email address.' }); return; }
    if (addr === current.toLowerCase()) { setMsg({ ok: false, text: 'That’s already your email.' }); return; }
    setBusy(true); setMsg(null);
    const { error } = await createClient().auth.updateUser(
      { email: addr },
      { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/settings?tab=account')}` },
    );
    setBusy(false);
    if (error) { setMsg({ ok: false, text: error.message || 'We couldn’t start the change. Try again.' }); return; }
    setMsg({ ok: true, text: `Check ${addr} for a confirmation link. Your email changes once you confirm it. If a link also arrives at your current address, confirm that one too.` });
    setNext('');
  };
  return (
    <div className="rx-card st">
      <p className="rx-sl">Email</p>
      {!open ? (
        <div><button type="button" className="rx-btn secondary" onClick={() => setOpen(true)}>Change email</button></div>
      ) : (
        <>
          <div className="rx-fld"><label htmlFor="newemail">New email</label>
            <input id="newemail" type="email" className="rx-in" autoComplete="email" value={next} onChange={(e) => setNext(e.target.value)} /></div>
          <div className="rx-row">
            <button type="button" className="rx-btn primary" disabled={busy} onClick={submit}>{busy ? 'Sending…' : 'Send confirmation link'}</button>
            <button type="button" className="rx-btn secondary" onClick={() => { setOpen(false); setMsg(null); }}>Cancel</button>
          </div>
        </>
      )}
      {msg && <p className="rx-sm" role={msg.ok ? 'status' : 'alert'} style={{ color: msg.ok ? undefined : 'var(--rx-danger)' }}>{msg.text}</p>}
    </div>
  );
}
