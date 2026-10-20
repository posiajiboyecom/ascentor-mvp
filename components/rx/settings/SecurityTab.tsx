'use client';

// Settings > Security: sign-in methods, password, two-step (not available yet), where you are signed in,
// privacy and safety. Password change goes through /api/account/password (current password re-checked on the server).

import { useState, useTransition } from 'react';
import { ArrowRight, Monitor } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/rx/Toast';
import { ProviderIcon, PROVIDER_NAME } from '@/components/auth/ProviderIcon';
import { DM_POLICIES } from '@/lib/rx/constants';
import { saveMessaging, saveResearch, unblockMember } from '@/app/(app)/settings/actions';
import { useRouter } from 'next/navigation';

export default function SecurityTab({ email, methods, hasPassword, dmPolicy, research, blocked }: {
  email: string; methods: string[]; hasPassword: boolean; dmPolicy: string; research: boolean; blocked: { id: string; name: string }[];
}) {
  const toast = useToast();
  const router = useRouter();
  const [, start] = useTransition();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErr, setPwErr] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [login, setLogin] = useState(true);
  const [res, setRes] = useState(research);
  const [who, setWho] = useState(dmPolicy);
  const [blockOpen, setBlockOpen] = useState(false);
  const [othersBusy, setOthersBusy] = useState(false);

  const changePassword = async () => {
    setPwErr('');
    if (pw.next.length < 10) { setPwErr('New password must be at least 10 characters.'); return; }
    if (pw.next !== pw.confirm) { setPwErr('Passwords do not match.'); return; }
    setPwBusy(true);
    try {
      const r = await fetch('/api/account/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }),
      });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) { setPwErr(body.error || 'Could not update your password. Please try again.'); }
      else {
        toast(body.message || 'Password updated.');
        setPw({ current: '', next: '', confirm: '' });
        setPwOpen(false);
        const { data: { user } } = await createClient().auth.getUser();
        if (!user) window.location.assign('/login?reason=session_expired');
      }
    } catch { setPwErr('Network error. Please check your connection and try again.'); }
    setPwBusy(false);
  };

  const signOutOthers = async () => {
    setOthersBusy(true);
    const { error } = await createClient().auth.signOut({ scope: 'others' });
    setOthersBusy(false);
    toast(error ? 'We couldn’t sign out your other devices. Please try again.' : 'Signed out of all other devices.');
  };

  return (
    <>
      <div className="rx-card st">
        <p className="rx-sl">Sign-in</p>
        {methods.filter((m) => m !== 'email').map((m) => (
          <div key={m} className="rx-sb">
            <div className="rx-row rx-nw" style={{ gap: 12, minWidth: 0 }}>
              <span className="rx-dimdot"><ProviderIcon provider={m} size={20} /></span>
              <div style={{ minWidth: 0 }}><p className="rx-p">{PROVIDER_NAME[m] ?? m}</p><p className="rx-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{email}</p></div>
            </div>
            <span className="rx-tag">Connected</span>
          </div>
        ))}
        {hasPassword ? (
          <>
            <div className="rx-sb"><div><p className="rx-p">Password</p><p className="rx-sm">Changing it keeps this device signed in and signs every other device out.</p></div>
              <button type="button" className="rx-btn secondary" onClick={() => setPwOpen(!pwOpen)}>{pwOpen ? 'Close' : 'Change password'}</button></div>
            {pwOpen && (
              <div className="rx-stack">
                <div className="rx-fld"><label htmlFor="pw0">Current password</label><input id="pw0" type="password" className="rx-in" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /></div>
                <div className="rx-fld"><label htmlFor="pw1">New password</label><input id="pw1" type="password" className="rx-in" autoComplete="new-password" placeholder="At least 10 characters, mixed case, with a number" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /></div>
                <div className="rx-fld"><label htmlFor="pw2">Confirm new password</label><input id="pw2" type="password" className="rx-in" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} /></div>
                {pwErr && <div className="rx-banner err" role="alert"><div>{pwErr}</div></div>}
                <div><button type="button" className="rx-btn primary" disabled={pwBusy || !pw.current || !pw.next || !pw.confirm} onClick={changePassword}>{pwBusy ? 'Updating...' : 'Update password'}</button></div>
              </div>
            )}
          </>
        ) : (
          <div className="rx-sb"><div><p className="rx-p">Password</p><p className="rx-sm">Not set. Add one to also sign in with your email.</p></div>
            <button type="button" className="rx-btn secondary" onClick={() => toast('We’ve emailed you a link to set a password.')}>Set a password</button></div>
        )}
      </div>

      <div className="rx-card st">
        <div className="rx-sb"><div><p className="rx-h3">Two-step verification</p><p className="rx-sm">Ask for a code from an authenticator app when you sign in on a new device.</p></div>
          <button type="button" className="rx-toggle" aria-label="Two-step verification" aria-pressed={false} onClick={() => toast('Two-step verification isn’t available yet.')} /></div>
      </div>

      <div className="rx-card st">
        <p className="rx-sl">Where you’re signed in</p>
        <div>
          <div className="rx-sessrow">
            <div className="rx-row rx-nw" style={{ gap: 12, minWidth: 0 }}><Monitor aria-hidden style={{ width: 20, height: 20 }} /><div style={{ minWidth: 0 }}><p className="rx-p">This browser</p><p className="rx-sm">Active now</p></div></div>
            <span className="rx-tag rust">This device</span>
          </div>
        </div>
        <div><button type="button" className="rx-btn secondary" disabled={othersBusy} onClick={signOutOthers}>Sign out of all other devices</button></div>
      </div>

      <div className="rx-card st">
        <p className="rx-sl">Privacy and safety</p>
        <div className="rx-fld"><label htmlFor="whom">Who can message me</label>
          <select id="whom" className="rx-in" value={who} onChange={(e) => { setWho(e.target.value); start(async () => { const r = await saveMessaging(e.target.value); toast(r.ok ? 'Saved.' : r.error); }); }}>
            {DM_POLICIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select></div>
        <div className="rx-sb"><div><p className="rx-p">New sign-in alerts</p><p className="rx-sm">Email me when a new device signs in.</p></div><button type="button" className="rx-toggle" aria-label="New sign-in alerts" aria-pressed={login} onClick={() => setLogin(!login)} /></div>
        <div className="rx-sb"><div><p className="rx-p">Research consent</p><p className="rx-sm">Share anonymised survey results.</p></div>
          <button type="button" className="rx-toggle" aria-label="Research consent" aria-pressed={res} onClick={() => { const v = !res; setRes(v); start(async () => { const r = await saveResearch(v); toast(r.ok ? 'Saved.' : r.error); }); }} /></div>
        <div className="rx-sb"><span>Blocked members</span>
          <button type="button" className="rx-btn lkb" aria-expanded={blockOpen} onClick={() => setBlockOpen(!blockOpen)}>{blocked.length} · Manage<ArrowRight aria-hidden /></button></div>
        {blockOpen && (
          <div className="rx-stack-sm">
            {blocked.length === 0 && <p className="rx-sm">You haven’t blocked anyone.</p>}
            {blocked.map((b) => (
              <div key={b.id} className="rx-sb"><span className="rx-sm">{b.name}</span>
                <button type="button" className="rx-link" style={{ minHeight: 36, fontSize: 14 }} onClick={() => start(async () => { const r = await unblockMember(b.id); toast(r.ok ? 'Unblocked.' : r.error); router.refresh(); })}>Unblock</button></div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
