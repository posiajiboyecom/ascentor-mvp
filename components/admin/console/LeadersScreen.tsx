'use client';

// Invite a Leader. Rules live on the server (app/admin/c/members/leaders/actions.ts): this only draws them.
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { inviteLeader, resendInvite, revokeInvite } from '@/app/admin/c/members/leaders/actions';

interface Row { id: string; email: string; name: string | null; status: 'sent' | 'used' | 'expired' | 'revoked'; invitedBy: string; createdAt: string; expiresAt: string; usedBy: string | null; usedAt: string | null; sendCount: number }

const LABEL = { sent: 'Sent', used: 'Used', expired: 'Expired', revoked: 'Revoked' } as const;
const TONE = { sent: 'warn', used: 'good', expired: '', revoked: 'bad' } as const;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }) : '-');

export default function LeadersScreen({ rows, setupMessage }: { rows: Row[]; setupMessage: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState('');
  const [shown, setShown] = useState<{ email: string; link: string; note: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (t: string) => { setToast(t); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4500); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const issue = (p: ReturnType<typeof inviteLeader>, to: string, after?: () => void) => start(async () => {
    try {
      const r = await p;
      if (!r.ok) { flash(r.error || 'That did not work.'); return; }
      setShown({ email: to, link: r.link ?? '', note: r.message ?? '' });
      setCopied(false);
      after?.();
      router.refresh();
    } catch { flash('That did not work. Please try again.'); }
  });

  const create = () => issue(inviteLeader(name, email), email.trim().toLowerCase(), () => { setName(''); setEmail(''); });
  const revoke = (r: Row) => start(async () => {
    const res = await revokeInvite(r.id);
    flash(res.ok ? res.message || 'Done.' : res.error || 'That did not work.');
    if (res.ok) router.refresh();
  });
  const copy = async () => { try { await navigator.clipboard.writeText(shown?.link ?? ''); setCopied(true); } catch { flash('Could not copy. Select the link and copy it.'); } };

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">People</p><h1 className="pt">Invite a Leader</h1><span className="ul" /></div>
          <Link href="/admin/c/members" className="btn bs">Back to Members</Link>
        </div>
        <p className="p" style={{ maxWidth: 820 }}>Each invite is a personal link tied to one email address. It works once and expires after 14 days. The person gets an email, and an alert in the app if they already have an account. Accepting gives them free Leader access: no payment and no card.</p>

        {setupMessage && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>{setupMessage}</p></div>}

        <div className="card st8">
          <p className="h3">New invite</p>
          <div className="row nw">
            <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" aria-label="Name" maxLength={120} />
            <input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label="Email" />
            <button type="button" className="btn bp" disabled={busy || !email.trim() || !!setupMessage} onClick={create}>Send invite</button>
          </div>
        </div>

        {shown && (
          <div className="card st8">
            <p className="h3">Link for {shown.email}</p>
            <p className="sm p">{shown.note}</p>
            <input className="in" readOnly value={shown.link} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
            <p className="sm p"><b>Shown once.</b> We keep only a scrambled version, so this link cannot be shown again. Copy it now if you want to share it on WhatsApp. If you lose it, use Resend to make a new one.</p>
            <div className="row">
              <button type="button" className="btn bp sm-btn" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
              <button type="button" className="btn bs sm-btn" onClick={() => setShown(null)}>Hide</button>
            </div>
          </div>
        )}

        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Invitee</th><th>Status</th><th>Invited by</th><th>Sent</th><th>Expires</th><th>Used by</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7}><span className="sm">No invites yet.</span></td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><span className="num">{r.name || r.email}</span>{r.name && <div className="sm">{r.email}</div>}</td>
                  <td><span className={`tag ${TONE[r.status]}`}><i />{LABEL[r.status]}</span></td>
                  <td>{r.invitedBy}</td>
                  <td>{day(r.createdAt)}{r.sendCount > 1 ? <span className="sm"> ({r.sendCount} sends)</span> : null}</td>
                  <td>{day(r.expiresAt)}</td>
                  <td>{r.usedBy ? `${r.usedBy}, ${day(r.usedAt)}` : '-'}</td>
                  <td>
                    <div className="row nw">
                      {(r.status === 'sent' || r.status === 'expired') && <button type="button" className="btn bs sm-btn" disabled={busy} onClick={() => issue(resendInvite(r.id), r.email)}>Resend</button>}
                      {r.status === 'sent' && <button type="button" className="btn bs sm-btn" disabled={busy} onClick={() => revoke(r)}>Revoke</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {toast && <div className="toast" role="status">{toast}</div>}
      </div>
    </div>
  );
}
