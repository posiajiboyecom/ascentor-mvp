'use client';

// Invite a mentor: personal mentor links. Rules live on the server (app/admin/c/mentors/invite/actions.ts): this only draws them.
import { useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { cancelMentorInvite, inviteMentor, renewMentorInvite } from '@/app/admin/c/mentors/invite/actions';

interface Row { id: string; email: string; name: string | null; status: 'sent' | 'used' | 'expired' | 'revoked'; invitedBy: string; createdAt: string; expiresAt: string; usedBy: string | null; usedAt: string | null; sendCount: number }

const LABEL = { sent: 'Sent', used: 'Used', expired: 'Expired', revoked: 'Cancelled' } as const;
const TONE = { sent: 'warn', used: 'good', expired: '', revoked: 'bad' } as const;
const waText = (name: string, link: string) => `Hi ${name.trim().split(/\s+/)[0] || 'there'}, here is your personal link to join Ascentor as a founding mentor. It takes about two minutes: ${link}`;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { timeZone: 'Africa/Lagos', day: 'numeric', month: 'short', year: 'numeric' }) : '-');

export default function MentorInvitesScreen({ rows, setupMessage }: { rows: Row[]; setupMessage: string }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [toast, setToast] = useState('');
  const [shown, setShown] = useState<{ email: string; name: string; link: string; note: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (t: string) => { setToast(t); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4500); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const issue = (p: ReturnType<typeof inviteMentor>, to: string, after?: () => void) => start(async () => {
    try {
      const r = await p;
      if (!r.ok) { flash(r.error || 'That did not work.'); return; }
      setShown({ email: to, name: r.name ?? '', link: r.link ?? '', note: r.message ?? '' });
      setCopied(false);
      after?.();
      router.refresh();
    } catch { flash('That did not work. Please try again.'); }
  });

  const create = () => issue(inviteMentor(name, email), email.trim().toLowerCase(), () => { setName(''); setEmail(''); });
  const revoke = (r: Row) => start(async () => {
    const res = await cancelMentorInvite(r.id);
    flash(res.ok ? res.message || 'Done.' : res.error || 'That did not work.');
    if (res.ok) router.refresh();
  });
  const copy = async () => { try { await navigator.clipboard.writeText(shown?.link ?? ''); setCopied(true); } catch { flash('Could not copy. Select the link and copy it.'); } };

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">People</p><h1 className="pt">Invite a mentor</h1><span className="ul" /></div>
          <Link href="/admin/c/mentors" className="btn bs">Back to Mentors</Link>
        </div>
        <p className="p" style={{ maxWidth: 820 }}>Each link is personal to one named person and their email. It works once and expires after 7 days. We email it to them, and you can also copy it to WhatsApp. Opening it lets them join straight as a mentor: one short form, no member sign-up, plan or Circle. They are active as soon as they join.</p>

        {setupMessage && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>{setupMessage}</p></div>}

        <div className="card st8">
          <p className="h3">New mentor link</p>
          <div className="row nw">
            <input className="in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Mentor’s full name" aria-label="Mentor’s full name" maxLength={120} />
            <input className="in" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" aria-label="Email" />
            <button type="button" className="btn bp" disabled={busy || !name.trim() || !email.trim() || !!setupMessage} onClick={create}>Create link</button>
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
              <a className="btn bs sm-btn" href={`https://wa.me/?text=${encodeURIComponent(waText(shown.name, shown.link))}`} target="_blank" rel="noopener noreferrer">Share on WhatsApp</a>
              <button type="button" className="btn bs sm-btn" onClick={() => setShown(null)}>Hide</button>
            </div>
          </div>
        )}

        <div className="tblwrap">
          <table className="tbl">
            <thead><tr><th>Mentor</th><th>Status</th><th>Invited by</th><th>Sent</th><th>Expires</th><th>Joined</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7}><span className="sm">No mentor links yet.</span></td></tr>}
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
                      {(r.status === 'sent' || r.status === 'expired') && <button type="button" className="btn bs sm-btn" disabled={busy} onClick={() => issue(renewMentorInvite(r.id), r.email)}>Renew</button>}
                      {r.status === 'sent' && <button type="button" className="btn bs sm-btn" disabled={busy} onClick={() => revoke(r)}>Cancel</button>}
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
