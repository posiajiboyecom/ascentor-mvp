'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquare } from 'lucide-react';
import { DIMENSIONS } from '@/lib/rx/constants';
import type { Suggestion, AdminGroupRow } from '@/lib/rx/admin';
import { archiveGroup, createGroup, dismissSuggestion, mergeGroup, editGroup, reactivateGroup, addGroupMember, removeGroupMember, getGroupMembers } from '@/app/admin/groups/actions';
import { useToast } from '@/components/rx/Toast';

const errp = (m: string) => <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{m}</p>;

export function SuggestionCards({ items }: { items: Suggestion[] }) {
  const router = useRouter();
  const toast = useToast();
  const [edits, setEdits] = useState<Record<string, { name: string; description: string } | undefined>>({});
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [scratch, setScratch] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', dimension: 'Community', fit: '' });

  return (
    <div className="rx-stack">
      {items.map((s) => {
        const e = edits[s.key];
        return (
          <div key={s.key} className="rx-card rx-stack rx-rise">
            <div className="rx-between" style={{ alignItems: 'flex-start' }}>
              <div className="rx-row rx-nw" style={{ gap: 12, minWidth: 0, flex: 1 }}>
                <span className="rx-dimdot"><MessageSquare aria-hidden /></span>
                <div style={{ minWidth: 0, flex: 1 }}>
                  {e ? <input className="rx-in" aria-label="Group name" value={e.name} onChange={(ev) => setEdits({ ...edits, [s.key]: { ...e, name: ev.target.value } })} /> : <p className="rx-h3">{s.name}</p>}
                  <p className="rx-sm">{s.dimLabel}</p>
                </div>
              </div>
              <span className="rx-tag">Suggested size {s.size}</span>
            </div>
            {e ? <input className="rx-in" aria-label="Group description" value={e.description} onChange={(ev) => setEdits({ ...edits, [s.key]: { ...e, description: ev.target.value } })} /> : <p className="rx-p">{s.description}</p>}
            <div className="rx-evi">
              <div><span className="n">{s.picks}</span><span className="rx-sm">Onboarding picks</span></div>
              <div><span className="n">{s.posts}</span><span className="rx-sm">Tagged posts</span></div>
              <div><span className="n">{s.requests}</span><span className="rx-sm">Group requests</span></div>
              <div><span className="n">{s.fitN}</span><span className="rx-sm">Members who fit</span></div>
            </div>
            <div className="rx-row">
              <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => start(async () => {
                const r = await createGroup({ key: s.key, name: e?.name ?? s.name, description: e?.description ?? s.description, dimension: s.dimension, fit: s.fit });
                if (!r.ok) { setError(r.error); return; }
                toast('Created. It’s in every directory and shown first to members who fit.'); router.refresh();
              })}>Create group</button>
              <button type="button" className="rx-link" onClick={() => setEdits({ ...edits, [s.key]: e ? undefined : { name: s.name, description: s.description } })}>{e ? 'Done' : 'Edit'}</button>
              <button type="button" className="rx-link muted" disabled={pending} onClick={() => start(async () => { await dismissSuggestion(s.key); toast('Dismissed. Members see no change.'); router.refresh(); })}>Dismiss</button>
            </div>
          </div>
        );
      })}
      {items.length === 0 && <div className="rx-card rx-empty"><p className="rx-p">No suggestions right now. New ones appear as members choose interests and tag posts.</p></div>}

      {scratch ? (
        <div className="rx-card rx-stack rx-rise">
          <p className="rx-label">New group</p>
          <input className="rx-in" aria-label="Group name" placeholder="Group name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rx-in" aria-label="One-line description" placeholder="Describe it in one line" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <select className="rx-in" aria-label="Dimension" value={form.dimension} onChange={(e) => setForm({ ...form, dimension: e.target.value })}>{DIMENSIONS.map((d) => <option key={d}>{d}</option>)}</select>
          <input className="rx-in" aria-label="Interests it fits" placeholder="Interests it fits, separated by commas" value={form.fit} onChange={(e) => setForm({ ...form, fit: e.target.value })} />
          <div className="rx-row"><button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
            const r = await createGroup({ name: form.name, description: form.description, dimension: form.dimension, fit: form.fit.split(',').map((x) => x.trim()).filter(Boolean) });
            if (!r.ok) { setError(r.error); return; }
            toast('Group created.'); setScratch(false); setForm({ name: '', description: '', dimension: 'Community', fit: '' }); router.refresh();
          })}>Create group</button><button type="button" className="rx-link muted" onClick={() => setScratch(false)}>Cancel</button></div>
        </div>
      ) : <div><button type="button" className="rx-btn primary" onClick={() => setScratch(true)}>Create from scratch</button></div>}
      {error && errp(error)}
    </div>
  );
}

function GroupRow({ g, active, allRows }: { g: AdminGroupRow; active: AdminGroupRow[]; allRows: AdminGroupRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [merging, setMerging] = useState(false);
  const [target, setTarget] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(g.name);
  const [editDesc, setEditDesc] = useState('');
  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<{ id: string; name: string; email: string }[] | null>(null);
  const [addEmail, setAddEmail] = useState('');

  const loadMembers = () => {
    if (members !== null) { setShowMembers((v) => !v); return; }
    start(async () => {
      const r = await getGroupMembers(g.id);
      if (!r.ok) { toast(r.error); return; }
      setMembers(r.members);
      setShowMembers(true);
    });
  };

  const statusLabel = g.status === 'archived' ? 'Archived' : g.isNew ? 'New' : g.quiet ? 'Quiet' : 'Active';
  const statusColor = g.status === 'archived' || g.quiet ? 'var(--rx-muted)' : undefined;

  return (
    <>
      <tr>
        <td>
          {editing ? (
            <input className="rx-in" style={{ minWidth: 160 }} value={editName} onChange={(e) => setEditName(e.target.value)} aria-label="Group name" />
          ) : (
            <span className="rx-strong">{g.name}</span>
          )}
          {g.isNew && !editing && <span className="rx-tag" style={{ marginLeft: 6 }}>New</span>}
        </td>
        <td>
          <button type="button" className="rx-link" style={{ fontSize: 13 }} onClick={loadMembers}>
            {showMembers ? '▲' : g.members}
          </button>
        </td>
        <td>{g.posts7d}</td>
        <td style={{ whiteSpace: 'nowrap' }}>{g.last ? new Date(g.last).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : 'Never'}</td>
        <td><span style={{ color: statusColor }}>{statusLabel}</span></td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <div className="rx-row rx-nw" style={{ gap: 6, flexWrap: 'wrap' }}>
            {editing ? (
              <>
                <button type="button" className="rx-btn primary" style={{ minHeight: 32, padding: '0 10px', fontSize: 13 }} disabled={pending}
                  onClick={() => start(async () => { const r = await editGroup(g.id, { name: editName, description: editDesc }); if (r.ok) { toast('Saved.'); setEditing(false); router.refresh(); } else toast(r.error); })}>Save</button>
                <button type="button" className="rx-link muted" style={{ fontSize: 13 }} onClick={() => { setEditing(false); setEditName(g.name); }}>Cancel</button>
              </>
            ) : (
              <button type="button" className="rx-link" style={{ fontSize: 13 }} onClick={() => setEditing(true)}>Edit</button>
            )}
            {g.status === 'archived' && !g.isFacilitators && (
              <button type="button" className="rx-link" style={{ fontSize: 13 }} disabled={pending}
                onClick={() => start(async () => { const r = await reactivateGroup(g.id); toast(r.ok ? 'Reactivated.' : r.error); router.refresh(); })}>Reactivate</button>
            )}
            {g.quiet && !g.isCity && !merging && (
              <>
                <button type="button" className="rx-link" style={{ fontSize: 13 }} onClick={() => { setMerging(true); setTarget(''); }}>Merge</button>
                <button type="button" className="rx-link" style={{ fontSize: 13 }} disabled={pending}
                  onClick={() => { if (!window.confirm(`Archive ${g.name}? Members keep their messages and are told where to go.`)) return; start(async () => { const r = await archiveGroup(g.id); toast(r.ok ? `${g.name} archived.` : r.error); router.refresh(); }); }}>Archive</button>
              </>
            )}
            {merging && (
              <span className="rx-row rx-nw" style={{ gap: 6 }}>
                <select className="rx-in" style={{ minHeight: 32, width: 'auto', fontSize: 13 }} aria-label="Merge into" value={target} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">Merge into…</option>{active.filter((a) => a.id !== g.id && !a.isCity).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <button type="button" className="rx-btn primary" style={{ minHeight: 32, padding: '0 10px', fontSize: 13 }} disabled={!target || pending}
                  onClick={() => start(async () => { const r = await mergeGroup(g.id, target); toast(r.ok ? 'Merged. Members were told.' : r.error); setMerging(false); router.refresh(); })}>Merge</button>
                <button type="button" className="rx-link muted" style={{ fontSize: 13 }} onClick={() => setMerging(false)}>Cancel</button>
              </span>
            )}
          </div>
        </td>
      </tr>
      {editing && (
        <tr>
          <td colSpan={6} style={{ paddingBottom: 8 }}>
            <input className="rx-in" placeholder="Short description (optional)" value={editDesc} onChange={(e) => setEditDesc(e.target.value)} aria-label="Group description" />
          </td>
        </tr>
      )}
      {showMembers && members !== null && (
        <tr>
          <td colSpan={6} style={{ background: 'var(--rx-surface)', paddingBottom: 12 }}>
            <div className="rx-stack" style={{ padding: '8px 0', gap: 6 }}>
              {members.length === 0 && <p className="rx-sm" style={{ marginLeft: 4 }}>No members yet.</p>}
              {members.map((m) => (
                <div key={m.id} className="rx-between" style={{ padding: '0 4px' }}>
                  <span className="rx-sm"><strong>{m.name}</strong> · {m.email}</span>
                  <button type="button" className="rx-link muted" style={{ fontSize: 13 }} disabled={pending}
                    onClick={() => start(async () => { const r = await removeGroupMember(g.id, m.id); if (!r.ok) { toast(r.error); return; } setMembers((prev) => prev ? prev.filter((x) => x.id !== m.id) : prev); toast('Removed.'); router.refresh(); })}>Remove</button>
                </div>
              ))}
              <div className="rx-row rx-nw" style={{ gap: 8, marginTop: 4, padding: '0 4px' }}>
                <input className="rx-in" type="email" placeholder="Add member by email" aria-label="Member email" value={addEmail} onChange={(e) => setAddEmail(e.target.value)} />
                <button type="button" className="rx-btn secondary" style={{ minHeight: 36, padding: '0 12px' }} disabled={pending || !addEmail}
                  onClick={() => start(async () => { const r = await addGroupMember(g.id, addEmail); if (!r.ok) { toast(r.error); return; } setAddEmail(''); setMembers(null); toast('Added.'); router.refresh(); })}>Add</button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function GroupsTable({ rows }: { rows: AdminGroupRow[] }) {
  const active = rows.filter((r) => r.status === 'active' && !r.isFacilitators);
  return (
    <div className="rx-card" style={{ overflowX: 'auto' }}>
      <table className="rx-tbl">
        <thead><tr><th>Group</th><th>Members</th><th>Posts, 7 days</th><th>Last active</th><th>Status</th><th /></tr></thead>
        <tbody>
          {rows.map((g) => <GroupRow key={g.id} g={g} active={active} allRows={rows} />)}
        </tbody>
      </table>
    </div>
  );
}
