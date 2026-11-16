'use client';

// Referral winners (10+ confirmed): their reward, the "above and beyond" switch (3 months instead of 2),
// their code and whether it has been emailed or used.

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { emailRewardCodes, markAboveAndBeyond } from './actions';

export interface WinnerRow {
  registrationId: string; name: string; email: string; confirmed: number;
  months: number; above: boolean; code: string | null; emailedAt: string | null; emailedMonths: number | null; redeemedAt: string | null;
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Lagos' }) : '');
const cell = { padding: '8px 10px', borderBottom: '1px solid var(--ledger-line, #e8e6e1)', textAlign: 'left' as const, whiteSpace: 'nowrap' as const };
const btn = { border: '1px solid var(--line, #cfcac2)', borderRadius: 8, padding: '8px 14px', background: 'var(--surface, #fff)', color: 'inherit', cursor: 'pointer', minHeight: 40, fontWeight: 600 } as const;

export default function WinnerRewards({ winners, canEdit }: { winners: WinnerRow[]; canEdit: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const run = (fn: () => Promise<{ ok: boolean; error?: string; message?: string }>) => start(async () => {
    const r = await fn();
    setNote({ ok: r.ok, text: r.message || r.error || (r.ok ? 'Done.' : 'That did not work.') });
    router.refresh();
  });
  const toSend = winners.filter((w) => !w.redeemedAt && (!w.emailedAt || w.emailedMonths !== w.months)).length;

  return (
    <section style={{ marginBottom: 32 }}>
      <h2 style={{ fontSize: 18, margin: '0 0 4px' }}>Winners and rewards</h2>
      <p style={{ fontSize: 14, opacity: 0.75, margin: '0 0 12px' }}>
        Everyone with 10 confirmed referrals gets Ascentor Builder free for 2 months. Tick “Above and beyond” for 3 months.
        Each winner gets their own one-use code by email. Ticks can change until the code is used.
      </p>
      {canEdit && winners.length > 0 && (
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
          <button type="button" style={btn} disabled={busy || toSend === 0} onClick={() => run(emailRewardCodes)}>
            {busy ? 'Working…' : toSend ? `Email codes to ${toSend} winner${toSend === 1 ? '' : 's'}` : 'All codes sent'}
          </button>
        </div>
      )}
      {note && <p role={note.ok ? 'status' : 'alert'} style={{ margin: '0 0 12px', fontSize: 14, color: note.ok ? 'inherit' : '#C0392B' }}>{note.text}</p>}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', display: 'table' }}>
          <thead><tr>{['Winner', 'Confirmed', 'Above and beyond', 'Reward', 'Code', 'Status'].map((h) => <th key={h} style={{ ...cell, fontSize: 12, textTransform: 'uppercase', opacity: 0.7 }}>{h}</th>)}</tr></thead>
          <tbody>
            {winners.length === 0 ? <tr><td style={cell} colSpan={6}>Nobody has reached 10 confirmed referrals yet.</td></tr> : winners.map((w) => (
              <tr key={w.registrationId}>
                <td style={cell}><b>{w.name}</b><br /><span style={{ fontSize: 12, opacity: 0.7 }}>{w.email || 'No email'}</span></td>
                <td style={cell}>{w.confirmed}</td>
                <td style={cell}>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 40, cursor: canEdit && !w.redeemedAt ? 'pointer' : 'default' }}>
                    <input type="checkbox" checked={w.above} disabled={!canEdit || busy || !!w.redeemedAt} onChange={(e) => run(() => markAboveAndBeyond(w.registrationId, e.target.checked))} style={{ width: 18, height: 18 }} />
                    <span style={{ fontSize: 13 }}>{w.above ? 'Yes' : 'No'}</span>
                  </label>
                </td>
                <td style={cell}>Builder · {w.months} months</td>
                <td style={{ ...cell, fontFamily: 'ui-monospace, Menlo, monospace' }}>{w.code ?? <span style={{ opacity: 0.6, fontFamily: 'inherit' }}>Made when emailed</span>}</td>
                <td style={cell}>
                  {w.redeemedAt ? `Used ${when(w.redeemedAt)}`
                    : w.emailedAt && w.emailedMonths !== w.months ? `Emailed ${when(w.emailedAt)} (${w.emailedMonths} months): send update`
                    : w.emailedAt ? `Emailed ${when(w.emailedAt)}`
                    : 'Not sent'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
