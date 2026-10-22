'use client';

// Referral credit: balance per member and the full ledger. Read only: credit is earned and spent by the billing engine,
// and there is deliberately no way to adjust it by hand.
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { CreditBalanceRow, CreditLedgerRow } from '@/lib/admin/billing-admin-data';
import '@/styles/admin-console.css';

const KINDS = ['All', 'Earned', 'Used', 'Expired', 'Cancelled'] as const;
const KIND_TONE: Record<string, string> = { Earned: 'good', Used: '', Expired: 'warn', Cancelled: 'bad' };

export default function CreditsScreen({ balances, ledger, total, note }: { balances: CreditBalanceRow[]; ledger: CreditLedgerRow[]; total: string; note: string }) {
  const [kind, setKind] = useState<(typeof KINDS)[number]>('All');
  const [q, setQ] = useState('');
  const needle = q.trim().toLowerCase();
  const bal = useMemo(() => balances.filter((b) => !needle || b.name.toLowerCase().includes(needle)), [balances, needle]);
  const led = useMemo(() => ledger.filter((l) => (kind === 'All' || l.kind === kind) && (!needle || `${l.member} ${l.source}`.toLowerCase().includes(needle))), [ledger, kind, needle]);

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">Revenue</p><h1 className="pt">Referral credits</h1><span className="ul" /></div>
          <Link href="/admin/c/referrals" className="btn bs">Back to Referrals</Link>
        </div>
        <p className="p" style={{ maxWidth: 820 }}>Credit a member earns when a friend they referred pays. It is spent on their next renewal. Credit is added and used by the billing engine only, so it cannot be adjusted here.</p>

        <div className="kpis">
          <div className="card kpi"><span className="k">Credit held</span><span className="v">{total}</span><span className="sm">Across all members, expired credit left out</span></div>
          <div className="card kpi"><span className="k">Members with credit history</span><span className="v">{balances.length}</span></div>
        </div>
        {note && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>{note}</p></div>}

        <label className="search" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', maxWidth: 360 }}>
          <Search className="ic ics" aria-hidden />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by member" aria-label="Search credits" style={{ border: 0, outline: 0, background: 'none', flex: 1, minWidth: 0 }} />
        </label>

        <p className="h3">Balance per member</p>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr>{['Member', 'Balance', 'Earned', 'Used', 'Expired or cancelled'].map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {bal.map((b) => (
                <tr key={b.userId}>
                  <td><span className="num">{b.name}</span></td>
                  <td><span className="num">{b.balance}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{b.earned}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{b.used}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{b.lost}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {bal.length === 0 && <div className="empty"><p className="h3">Nothing here</p><p className="sm">No member has earned credit yet.</p></div>}
        </div>

        <p className="h3">Ledger</p>
        <div className="opts" role="group" aria-label="Filter the ledger">
          {KINDS.map((f) => {
            const n = f === 'All' ? ledger.length : ledger.filter((l) => l.kind === f).length;
            return <button key={f} type="button" aria-pressed={kind === f} className={`opt${kind === f ? ' on' : ''}`} onClick={() => setKind(f)}>{f} · {n}</button>;
          })}
        </div>
        <div className="tblwrap">
          <table className="tbl">
            <thead><tr>{['Member', 'Type', 'Amount', 'Source', 'Date', 'Expires'].map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
            <tbody>
              {led.map((l) => (
                <tr key={l.id}>
                  <td><span className="num">{l.member}</span></td>
                  <td><span className={`tag ${KIND_TONE[l.kind] ?? ''}`}><i />{l.kind}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{l.amount}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{l.source}</span>{l.flagged && <>{' '}<span className="tag bad"><i />Flagged</span></>}</td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{l.date}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{l.expires}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {led.length === 0 && <div className="empty"><p className="h3">Nothing here</p><p className="sm">{ledger.length === 0 ? 'The ledger is empty.' : 'No rows match this filter or search.'}</p></div>}
        </div>
        <p className="sm">Showing {led.length} of {ledger.length}.</p>
      </div>
    </div>
  );
}
