'use client';

// Settings > Account: who you are (read-only), display and language, your data, sign out, delete account.

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CalendarDays, KeyRound, LogOut, Mail, Trash2, UserRound } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { confirmAction } from '@/components/Modal';
import { useToast } from '@/components/rx/Toast';
import { LanguageSelect, TimezoneSelect } from '@/components/rx/settings/SettingsClient';

const PROVIDER: Record<string, string> = { google: 'Google', linkedin_oidc: 'LinkedIn', linkedin: 'LinkedIn', email: 'Email and password' };

export default function AccountTab({ name, email, memberSince, methods, hasPassword, language, timezoneLabel }: {
  name: string; email: string; memberSince: string; methods: string[]; hasPassword: boolean; language: string; timezoneLabel: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [light, setLight] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [delTxt, setDelTxt] = useState('');
  const [delPw, setDelPw] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [delErr, setDelErr] = useState<{ message: string; code?: string } | null>(null);

  const delOk = delTxt.trim() === 'DELETE';

  const signOut = async () => {
    if (!(await confirmAction('Sign out of Ascentor on this device?', { title: 'Sign out?', confirmLabel: 'Sign out' }))) return;
    setSigningOut(true);
    await createClient().auth.signOut();
    router.push('/');
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
      <p className="rx-sm">These come from your sign-in and can’t be edited here. To correct your name or email, contact support.</p>

      <div className="rx-card st">
        <p className="rx-sl">Display and language</p>
        <div className="rx-sb"><span>Light mode</span><button type="button" className="rx-toggle" aria-label="Light mode" aria-pressed={light} onClick={() => setLight(!light)} /></div>
        <div className="rx-fld"><span className="rx-fld-label">Language</span><LanguageSelect value={language} /></div>
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
        <p className="rx-p">Permanently deletes your account and personal data, including what Sage knows and your check-ins. If you have an active subscription, cancel it under Plan first. This can’t be undone.</p>
        {hasPassword && (
          <div className="rx-fld"><label htmlFor="delpw">Your password</label><input id="delpw" type="password" className="rx-in" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></div>
        )}
        <div className="rx-fld"><label htmlFor="delc">Type DELETE to confirm</label><input id="delc" className="rx-in" placeholder="DELETE" value={delTxt} onChange={(e) => setDelTxt(e.target.value)} /></div>
        {delErr && (
          <div className="rx-banner err" role="alert">
            <div>{delErr.message}{delErr.code === 'subscription_active' && <> <Link href="/settings?tab=plan" scroll={false} style={{ color: 'inherit', fontWeight: 600 }}>Go to Plan</Link></>}</div>
          </div>
        )}
        <div><button type="button" className={`rx-btn ${delOk ? 'bdanger' : 'bmuted'}`} aria-disabled={!delOk || deleting} onClick={deleteAccount}>{deleting ? 'Deleting...' : 'Delete my account'}</button></div>
      </div>
    </>
  );
}
