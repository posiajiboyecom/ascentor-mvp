'use client';

// The one form on a mentor link: name, a password (new accounts only) and the short profile Circles see when they choose.
import { useActionState } from 'react';
import Link from 'next/link';
import { AuthPassword } from '@/components/auth/AuthShell';
import { PASSWORD_MIN } from '@/lib/auth/password-policy';
import { joinExisting, joinNew, type JoinState } from './actions';

export default function MentorJoinForm({ token, email, name, mode }: { token: string; email: string; name: string; mode: 'new' | 'existing' }) {
  const [state, action, busy] = useActionState<JoinState, FormData>(mode === 'new' ? joinNew : joinExisting, {});
  const here = `/mentor/join/${token}`;
  return (
    <form className="ax-st" action={action}>
      <input type="hidden" name="token" value={token} />
      <div className="ax-fld">
        <label htmlFor="mj-email">Email</label>
        <input id="mj-email" className="ax-in" value={email} readOnly aria-readonly="true" />
        <p className="ax-sm">This link is personal to this address.</p>
      </div>
      <div className="ax-fld">
        <label htmlFor="mj-name">Full name</label>
        <input id="mj-name" name="fullName" className="ax-in" autoComplete="name" defaultValue={name} required maxLength={80} disabled={busy} />
      </div>
      {mode === 'new' && (
        <>
          <div className="ax-fld">
            <label htmlFor="mj-pw">Choose a password</label>
            <AuthPassword id="mj-pw" name="password" placeholder={`At least ${PASSWORD_MIN} characters`} autoComplete="new-password" required disabled={busy} />
            <p className="ax-sm">Use upper and lower case letters and a number.</p>
          </div>
          <div className="ax-fld">
            <label htmlFor="mj-pw2">Confirm password</label>
            <AuthPassword id="mj-pw2" name="confirm" placeholder="Type it again" autoComplete="new-password" required disabled={busy} />
          </div>
        </>
      )}
      <div className="ax-fld">
        <label htmlFor="mj-head">Your headline</label>
        <input id="mj-head" name="headline" className="ax-in" placeholder="Product lead in fintech" required maxLength={120} disabled={busy} />
        <p className="ax-sm">One line Circles see first when they choose a mentor.</p>
      </div>
      <div className="ax-fld">
        <label htmlFor="mj-exp">What you can help with</label>
        <input id="mj-exp" name="expertise" className="ax-in" placeholder="Career change, Leadership, Starting a business" required disabled={busy} />
        <p className="ax-sm">Separate with commas.</p>
      </div>
      <div className="ax-fld">
        <label htmlFor="mj-lang">Languages</label>
        <input id="mj-lang" name="langs" className="ax-in" defaultValue="English" disabled={busy} />
      </div>
      <div className="ax-fld">
        <label htmlFor="mj-bio">A few words about you (optional)</label>
        <textarea id="mj-bio" name="bio" className="ax-in" rows={3} maxLength={1200} disabled={busy} style={{ resize: 'vertical' }} />
      </div>
      {state.error && <p className="ax-banner err" role="alert">{state.error}</p>}
      {state.exists && <Link href={`/login?redirect=${encodeURIComponent(here)}`} className="ax-btn bs bw">Log in to finish</Link>}
      <button type="submit" className="ax-btn bp bw" disabled={busy}>{busy ? 'Setting you up...' : 'Join as a mentor'}</button>
    </form>
  );
}
