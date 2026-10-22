'use client';

// Billing groups (friends who pay together). Rules live on the server (app/admin/c/members/groups/actions.ts): this only draws them.
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Check, Search, X } from 'lucide-react';
import { RANK, toneOf, type Level } from '@/lib/admin/areas';
import type { GroupRow } from '@/lib/admin/billing-admin-data';
import { clearGroupFlag, flagGroup, removeGroupMember } from '@/app/admin/c/members/groups/actions';
import '@/styles/admin-console.css';

const tone = (v: string) => { const t = toneOf(v); return t === 'plain' ? '' : t; };
const FILTERS = ['All', 'Forming', 'Active', 'Broken', 'Flagged'] as const;

export default function GroupsScreen({ rows, note, level }: { rows: GroupRow[]; note: string; level: Level }) {
  const router = useRouter();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('All');
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<{ group: GroupRow; userId: string; name: string } | null>(null);
  const [toast, setToast] = useState('');
  const [busy, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flash = (t: string) => { setToast(t); if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setToast(''), 4500); };
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { setReason(''); }, [sel]);

  const can = (need: Level) => RANK[level] >= RANK[need];
  const selected = sel ? rows.find((r) => r.id === sel) ?? null : null;
  const countOf = (f: string) => rows.filter((r) => (f === 'All' ? true : f === 'Flagged' ? r.flagged : r.status === f)).length;

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => (filter === 'All' || (filter === 'Flagged' ? r.flagged : r.status === filter))
      && (!needle || [r.code, r.status, r.planSummary, ...r.members.map((m) => m.name)].join(' ').toLowerCase().includes(needle)));
  }, [rows, filter, q]);

  const run = (p: Promise<{ ok: boolean; message?: string; error?: string }>) => start(async () => {
    const res = await p;
    flash(res.ok ? res.message || 'Done.' : res.error || 'That did not work.');
    if (res.ok) { setReason(''); router.refresh(); }
  });

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end' }}>
          <div><p className="eyebrow">People</p><h1 className="pt">Groups</h1><span className="ul" /></div>
          <Link href="/admin/c/members" className="btn bs">Back to Members</Link>
        </div>
        <p className="p" style={{ maxWidth: 820 }}>Friends who pay together. Three or more active members get the group price. Only admins can see who is in a group: members see the active count and nothing else.</p>

        {level === 'view' && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>View only. Your role can look at this area but not change it.</p></div>}
        {note && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}>{note}</p></div>}

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div className="opts" role="group" aria-label="Filter groups">
            {FILTERS.map((f) => <button key={f} type="button" aria-pressed={filter === f} className={`opt${filter === f ? ' on' : ''}`} onClick={() => setFilter(f)}>{f} · {countOf(f)}</button>)}
          </div>
          <label className="search" style={{ display: 'flex', alignItems: 'center', gap: 8, height: 40, padding: '0 12px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', minWidth: 240 }}>
            <Search className="ic ics" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by code or member" aria-label="Search groups" style={{ border: 0, outline: 0, background: 'none', flex: 1, minWidth: 0 }} />
          </label>
        </div>

        <div className="tblwrap">
          <table className="tbl">
            <thead><tr>{['Group', 'Status', 'Active', 'Plan', 'Members', 'Created', 'Notes'].map((c) => <th key={c} scope="col">{c}</th>)}<th scope="col"><span style={{ position: 'absolute', left: -9999 }}>Actions</span></th></tr></thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className={sel === r.id ? 'sel' : ''}>
                  <td><button type="button" className="rowbtn" onClick={() => setSel(r.id)}>{r.code}</button></td>
                  <td><span className={`tag ${tone(r.status)}`}><i />{r.status}</span></td>
                  <td><span className="num">{r.activeCount}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{r.planSummary}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{r.members.filter((m) => m.active).map((m) => m.name).join(', ') || '-'}</span></td>
                  <td><span className="sm" style={{ color: 'var(--text)' }}>{r.created}</span></td>
                  <td>
                    {r.flagged && <span className="tag bad" title={r.flagReason}><i />Flagged</span>}{' '}
                    {r.notice && <span className="tag warn"><i />Replacements may be needed</span>}
                    {!r.flagged && !r.notice && <span className="sm">-</span>}
                  </td>
                  <td style={{ textAlign: 'right' }}><button type="button" className="lk" onClick={() => setSel(r.id)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length === 0 && (
            <div className="empty"><p className="h3">Nothing here</p><p className="sm">{rows.length === 0 ? 'There are no groups yet.' : 'No groups match this filter or search.'}</p></div>
          )}
        </div>
        <p className="sm">Showing {shown.length} of {rows.length}.</p>
      </div>

      {selected && (
        <>
          <button type="button" className="scrim" aria-label="Close details" onClick={() => setSel(null)} style={{ border: 0 }} />
          <aside className="drawer" role="dialog" aria-label={`Group ${selected.code}`}>
            <div className="dhead">
              <div style={{ flex: 1, minWidth: 0 }}>
                <p className="eyebrow">Group</p>
                <p className="h2">{selected.code}</p>
                <p style={{ margin: '8px 0 0' }}>
                  <span className={`tag ${tone(selected.status)}`}><i />{selected.status}</span>{' '}
                  {selected.flagged && <span className="tag bad"><i />Flagged</span>}
                </p>
              </div>
              <button type="button" className="ib" aria-label="Close" onClick={() => setSel(null)} style={{ background: 'none', border: 0, cursor: 'pointer', width: 40, height: 40 }}><X className="ic" aria-hidden /></button>
            </div>
            <div className="dbody">
              {selected.notice && <div className="rz" role="alert" style={{ borderColor: 'var(--gold)' }}><p className="sm" style={{ color: 'var(--text)' }}><b>{selected.notice}</b> One more departure drops the group below the 3 it needs for the group price.</p></div>}
              {selected.flagged && <div className="rz"><p className="sm" style={{ color: 'var(--text)' }}><b>Flagged:</b> {selected.flagReason || '-'}</p></div>}
              <dl className="kv">
                <dt>Active members</dt><dd>{selected.activeCount}</dd>
                <dt>Plan</dt><dd>{selected.planSummary}</dd>
                <dt>Created</dt><dd>{selected.created}</dd>
              </dl>
              <div className="st8">
                <p className="sl">Members</p>
                {selected.members.length === 0 && <p className="sm">No members.</p>}
                {selected.members.map((m) => (
                  <div key={`${m.userId}${m.joined}`} className="rz">
                    <div className="sb">
                      <p className="p" style={{ fontWeight: 600, margin: 0 }}>{m.name}{m.freeLeader ? ' (free Leader, not counted)' : ''}</p>
                      {m.active && can('full') && <button type="button" className="btn bd sm-btn" disabled={busy} onClick={() => setConfirmRemove({ group: selected, userId: m.userId, name: m.name })}>Remove member</button>}
                    </div>
                    <p className="sm">Joined {m.joined}{m.left ? `, left ${m.left}` : ''} · {m.plan} · {m.state}</p>
                  </div>
                ))}
                {can('edit') && !can('full') && <p className="sm">Removing a member needs a role with Full access to Members.</p>}
              </div>
              <div className="st8">
                <p className="sl">Review</p>
                {can('edit') ? (selected.flagged ? (
                  <div className="row"><button type="button" className="btn bs" disabled={busy} onClick={() => run(clearGroupFlag(selected.id))}>Clear flag</button></div>
                ) : (
                  <div className="st8">
                    <input className="in" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} placeholder="Why does this group need review?" aria-label="Reason for review" />
                    <div className="row"><button type="button" className="btn bs" disabled={busy || !reason.trim()} onClick={() => run(flagGroup(selected.id, reason))}>Flag for review</button></div>
                  </div>
                )) : <p className="sm">View only.</p>}
              </div>
            </div>
          </aside>
        </>
      )}

      {confirmRemove && (
        <>
          <button type="button" className="scrim modalscrim" aria-label="Cancel" onClick={() => setConfirmRemove(null)} style={{ border: 0 }} />
          <div className="modal" role="alertdialog" aria-label="Remove member?">
            <p className="h2">Remove member?</p>
            <p className="p">{confirmRemove.name} leaves group {confirmRemove.group.code}. This changes the group's active count and is recorded in their billing history.</p>
            <div className="row" style={{ justifyContent: 'flex-end', gap: 8 }}>
              <button type="button" className="btn bs" onClick={() => setConfirmRemove(null)}>Go back</button>
              <button type="button" className="btn bd" onClick={() => { const c = confirmRemove; setConfirmRemove(null); run(removeGroupMember(c.group.id, c.userId)); }}>Remove member</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast" role="status" aria-live="polite"><Check className="gc" aria-hidden />{toast}</div>}
    </div>
  );
}
