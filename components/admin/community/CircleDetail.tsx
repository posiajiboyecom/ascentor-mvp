'use client';
// One Circle in Admin → Circles: settings, members and facilitator, lifecycle, chat, mentor sessions, notices,
// merge and delete. Every change goes through app/admin/c/circles/actions.ts, which checks the level again.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  addCircleMember, cancelCircleSession, deleteCircle, deleteCircleMessage, loadCircle, mergeCircle, moveCircleMember,
  notifyCircle, pinCircleMessage, postCircleMessage, removeCircleMember, searchMembers, setCircleLifecycle, setCircleRole, updateCircle,
  type CircleDetail as Detail, type CircleInput, type CircleRow,
} from '@/app/admin/c/circles/actions';
import { CircleFields, MAX, meetingLabel, statusTag } from './circle-shared';
import { Avatar, NoticeForm, PersonPicker, Tag, day, run, when } from './ui';

type Flash = (t: string, bad?: boolean) => void;

export default function CircleDetail({ id, circles, canEdit, canFull, flash, onBack, onOpen, onChanged }: {
  id: string; circles: CircleRow[]; canEdit: boolean; canFull: boolean; flash: Flash;
  onBack: () => void; onOpen: (id: string) => void; onChanged: () => Promise<void>;
}) {
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { const r = await loadCircle(id); if (r.ok) { setD(r.detail); setErr(''); } else setErr(r.error); }, [id]);
  useEffect(() => { setD(null); void load(); }, [load]);

  /** Runs a change, then reloads this Circle and the list. */
  const act = async <T,>(call: (force: boolean) => Promise<({ ok: true } & T) | { ok: false; error: string }>, okText?: string) => {
    setBusy(true);
    const r = await run(flash, call, okText);
    if (r) { await load(); await onChanged(); }
    setBusy(false);
    return r;
  };

  if (err) return <div className="cm-stack"><button type="button" className="cm-back" onClick={onBack}>← All Circles</button><div className="cm-note bad">{err}</div></div>;
  if (!d) return <div className="cm-stack"><button type="button" className="cm-back" onClick={onBack}>← All Circles</button><p className="sm">Loading…</p></div>;

  const c = d.circle;
  const members = d.seats.filter((s) => s.role === 'member');
  const others = circles.filter((x) => x.id !== c.id && x.status !== 'completed');
  const ed = canEdit && !busy;

  return (
    <div className="cm-stack">
      <button type="button" className="cm-back" onClick={onBack}>← All Circles</button>
      <div className="sb" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <p className="eyebrow">{c.is_demo ? 'Demo Circle' : c.interest ? 'Interest Circle' : 'Home Circle'} · Circle {c.number}</p>
          <h1 className="pt">{c.interest || c.name}</h1><span className="ul" />
        </div>
        <div className="cm-row">
          {statusTag(c.status)}
          <span className="sm">{members.length}/{MAX} members · {meetingLabel(c.meeting_dow, c.meeting_time)} · {c.language ?? 'English'}</span>
          <a className="btn bs sm-btn" href={`/circle?c=${c.id}`} target="_blank" rel="noreferrer">Open in app</a>
        </div>
      </div>
      {c.merged_into && (
        <div className="cm-note">This Circle was merged into <button type="button" className="lk" onClick={() => onOpen(c.merged_into!)}>{circles.find((x) => x.id === c.merged_into)?.title ?? 'another Circle'}</button>. Reopen it to use it again.</div>
      )}
      {d.mergedFrom.length > 0 && <p className="sm">Merged into this Circle: {d.mergedFrom.map((m, i) => <span key={m.id}>{i ? ', ' : ''}<button type="button" className="lk" onClick={() => onOpen(m.id)}>{m.title}</button></span>)}</p>}

      <div className="cm-two">
        <div className="cm-stack">
          <Members d={d} others={others} ed={ed} act={act} />
          <Chat d={d} ed={ed} act={act} />
          <Sessions d={d} ed={ed} act={act} />
        </div>
        <div className="cm-stack">
          <Lifecycle d={d} ed={ed} act={act} />
          <Settings d={d} ed={ed} act={act} />
          <div className="cm-card"><h3>Message everyone</h3><NoticeForm to={`the ${d.seats.length} people in this Circle`} disabled={!ed} onSend={async (t, b) => !!(await act(() => notifyCircle(c.id, t, b), 'Notice sent.'))} /></div>
          {canFull && <Danger d={d} others={others} busy={busy} act={act} onDeleted={onBack} />}
        </div>
      </div>
    </div>
  );
}

type Act = <T>(call: (force: boolean) => Promise<({ ok: true } & T) | { ok: false; error: string }>, okText?: string) => Promise<({ ok: true } & T) | null>;

// ── members ─────────────────────────────────────────────────────────────────
function Members({ d, others, ed, act }: { d: Detail; others: CircleRow[]; ed: boolean; act: Act }) {
  const c = d.circle;
  const [role, setRole] = useState<'member' | 'facilitator'>('member');
  const [move, setMove] = useState<Record<string, string>>({});
  const inCircle = useMemo(() => new Set(d.seats.map((s) => s.id)), [d.seats]);
  const fac = d.seats.find((s) => s.role === 'facilitator');
  return (
    <div className="cm-card">
      <h3>People <small>{d.seats.filter((s) => s.role === 'member').length} members{fac ? ' · 1 facilitator' : ' · no facilitator'}</small></h3>
      {ed && (
        <div className="cm-row" style={{ alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 260px' }}><PersonPicker search={searchMembers} exclude={inCircle} busy={!ed}
            onPick={async (p) => { await act((force) => addCircleMember(c.id, p.id, role, { force }), role === 'facilitator' ? `${p.name} is now the facilitator.` : `${p.name} added.`); }} /></div>
          <select className="in" style={{ width: 'auto' }} value={role} onChange={(e) => setRole(e.target.value as 'member' | 'facilitator')} aria-label="Add as"><option value="member">Add as member</option><option value="facilitator">Add as facilitator</option></select>
        </div>
      )}
      {d.seats.length === 0 ? <p className="sm">Nobody is in this Circle yet.</p> : (
        <div className="cm-list">
          {d.seats.map((s) => (
            <div key={s.id} className="cm-li">
              <div className="cm-person"><Avatar p={s} /><span><b>{s.name} {s.role === 'facilitator' && <Tag tone="good">Facilitator</Tag>}</b><small>{s.email ?? ''} · joined {day(s.joined_at)}{s.otherCircles ? ` · in ${s.otherCircles} other ${s.otherCircles === 1 ? 'Circle' : 'Circles'}` : ''}</small></span></div>
              {ed && (
                <div className="cm-acts">
                  {s.role === 'member'
                    ? <button type="button" className="lk" onClick={() => act(() => setCircleRole(c.id, s.id, 'facilitator'), `${s.name} is now the facilitator.`)}>Make facilitator</button>
                    : <button type="button" className="lk" onClick={() => act(() => setCircleRole(c.id, s.id, 'member'), `${s.name} is now a member.`)}>Make member</button>}
                  {s.role === 'member' && others.length > 0 && (
                    <>
                      <select className="in" value={move[s.id] ?? ''} onChange={(e) => setMove({ ...move, [s.id]: e.target.value })} aria-label={`Move ${s.name} to`}>
                        <option value="">Move to…</option>
                        {others.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.members}/{MAX})</option>)}
                      </select>
                      {move[s.id] && <button type="button" className="btn bs sm-btn" onClick={() => act((force) => moveCircleMember(c.id, s.id, move[s.id], { force }), `${s.name} moved.`)}>Move</button>}
                    </>
                  )}
                  <button type="button" className="lk bad" onClick={() => {
                    if (!window.confirm(`Remove ${s.name} from this Circle?`)) return;
                    const tell = window.confirm(`Tell ${s.name} they’ve been removed? (OK to notify, Cancel to remove quietly)`);
                    void act(() => removeCircleMember(c.id, s.id, { notify: tell }), `${s.name} removed.`);
                  }}>Remove</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── lifecycle ───────────────────────────────────────────────────────────────
function Lifecycle({ d, ed, act }: { d: Detail; ed: boolean; act: Act }) {
  const c = d.circle;
  const n = d.seats.filter((s) => s.role === 'member').length;
  return (
    <div className="cm-card">
      <h3>Cycle</h3>
      <dl className="kv">
        <dt>Status</dt><dd>{statusTag(c.status)}</dd>
        <dt>Cycle started</dt><dd>{c.cycle_start ? day(c.cycle_start) : 'Not yet'}</dd>
        <dt>Created</dt><dd>{when(c.created_at)}</dd>
        <dt>Mentor</dt><dd>{d.mentor ? `${d.mentor.name} (${d.mentor.status})` : 'None chosen yet'}</dd>
      </dl>
      {ed && (
        <div className="cm-row">
          {c.status === 'forming' && <button type="button" className="btn bp sm-btn" onClick={() => { if (n < 3 && !window.confirm(`This Circle has ${n} ${n === 1 ? 'member' : 'members'}. Start it anyway?`)) return; void act(() => setCircleLifecycle(c.id, 'start'), 'Circle started. Members have been told.'); }}>Start now</button>}
          {c.status === 'active' && <button type="button" className="btn bs sm-btn" onClick={() => { if (window.confirm('Start a fresh 90-day cycle from today? Members are told.')) void act(() => setCircleLifecycle(c.id, 'restart'), 'New cycle started.'); }}>Restart cycle</button>}
          {c.status !== 'completed' && <button type="button" className="btn bs sm-btn" onClick={() => { if (window.confirm('Close this Circle? Members keep their history, and new members won’t be placed here.')) void act(() => setCircleLifecycle(c.id, 'complete'), 'Circle closed.'); }}>Close Circle</button>}
          {c.status === 'completed' && <button type="button" className="btn bs sm-btn" onClick={() => act(() => setCircleLifecycle(c.id, 'reopen'), 'Circle reopened as Forming.')}>Reopen</button>}
        </div>
      )}
    </div>
  );
}

// ── settings ────────────────────────────────────────────────────────────────
function Settings({ d, ed, act }: { d: Detail; ed: boolean; act: Act }) {
  const c = d.circle;
  const start = useMemo<CircleInput>(() => ({
    name: c.name, interest: c.interest ?? '', language: c.language ?? 'English', timezone: c.timezone ?? '', stage: c.stage, slot: c.slot,
    meeting_dow: c.meeting_dow, meeting_time: c.meeting_time.slice(0, 5), meeting_url: c.meeting_url ?? '', focus: c.focus ?? '',
    cycle_start: c.cycle_start ?? '', is_demo: c.is_demo, health_override: c.health_override,
  }), [c]);
  const [v, setV] = useState<CircleInput>(start);
  useEffect(() => setV(start), [start]);
  const dirty = JSON.stringify(v) !== JSON.stringify(start);
  return (
    <form className="cm-card" onSubmit={async (e) => { e.preventDefault(); await act(() => updateCircle(c.id, v), 'Saved.'); }}>
      <h3>Settings</h3>
      <div className="fld"><label htmlFor="s-name">Name</label><input id="s-name" className="in" value={v.name ?? ''} maxLength={60} disabled={!ed} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
      <CircleFields v={v} set={(p) => setV({ ...v, ...p })} disabled={!ed} />
      <div className="cm-grid">
        <div className="fld"><label htmlFor="s-cs">Cycle start</label><input id="s-cs" type="date" className="in" value={v.cycle_start ?? ''} disabled={!ed} onChange={(e) => setV({ ...v, cycle_start: e.target.value })} /></div>
        <div className="fld"><label htmlFor="s-h">Health</label><select id="s-h" className="in" value={v.health_override ?? ''} disabled={!ed} onChange={(e) => setV({ ...v, health_override: e.target.value || null })}><option value="">Worked out from attendance</option><option value="healthy">Always show as healthy</option></select></div>
      </div>
      <label className="cm-row sm"><input type="checkbox" checked={!!v.is_demo} disabled={!ed} onChange={(e) => setV({ ...v, is_demo: e.target.checked })} /> Demo Circle (hidden from formation, reports and real notices)</label>
      {ed && <div className="cm-row"><button type="submit" className="btn bp sm-btn" disabled={!dirty}>Save changes</button>{dirty && <button type="button" className="btn bs sm-btn" onClick={() => setV(start)}>Undo</button>}</div>}
    </form>
  );
}

// ── chat ────────────────────────────────────────────────────────────────────
function Chat({ d, ed, act }: { d: Detail; ed: boolean; act: Act }) {
  const [text, setText] = useState('');
  return (
    <div className="cm-card">
      <h3>Chat <small>latest {d.messages.length}</small></h3>
      {ed && (
        <form className="cm-row" onSubmit={async (e) => { e.preventDefault(); if (await act(() => postCircleMessage(d.circle.id, text), 'Posted as the Ascentor team.')) setText(''); }}>
          <input className="in" style={{ flex: '1 1 240px' }} value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} placeholder="Post in this Circle’s chat as the Ascentor team" aria-label="Message" />
          <button type="submit" className="btn bs sm-btn" disabled={!text.trim()}>Post</button>
        </form>
      )}
      {d.messages.length === 0 ? <p className="sm">No messages yet.</p> : (
        <div className="cm-chat">
          {d.messages.map((m) => (
            <div key={m.id} className={`cm-msg${m.pinned ? ' pin' : ''}`}>
              <header><span><b>{m.author}</b> · {when(m.created_at)}{m.pinned ? ' · pinned' : ''}{m.is_win ? ' · win' : ''}</span>
                {ed && <span className="cm-acts">
                  <button type="button" className="lk" onClick={() => act(() => pinCircleMessage(m.id, !m.pinned), m.pinned ? 'Unpinned.' : 'Pinned.')}>{m.pinned ? 'Unpin' : 'Pin'}</button>
                  <button type="button" className="lk bad" onClick={() => { if (window.confirm('Delete this message for everyone?')) void act(() => deleteCircleMessage(m.id), 'Message deleted.'); }}>Delete</button>
                </span>}
              </header>
              <p>{m.kind === 'text' ? m.body : m.kind === 'voice' ? '🎙 Voice note' : '🖼 Image'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── mentor sessions ─────────────────────────────────────────────────────────
function Sessions({ d, ed, act }: { d: Detail; ed: boolean; act: Act }) {
  if (!d.sessions.length) return <div className="cm-card"><h3>Mentor sessions</h3><p className="sm">{d.mentor ? 'No sessions booked yet.' : 'This Circle hasn’t chosen a mentor yet.'}</p></div>;
  const now = Date.now();
  return (
    <div className="cm-card">
      <h3>Mentor sessions <small>{d.mentor?.name ?? ''}</small></h3>
      <div className="cm-list">
        {d.sessions.map((s) => {
          const future = new Date(s.starts_at).getTime() > now;
          return (
            <div key={s.id} className="cm-li">
              <span><b style={{ fontSize: 14 }}>{when(s.starts_at)}</b><small className="sm" style={{ display: 'block' }}>{s.mentor} · {s.questions} {s.questions === 1 ? 'question' : 'questions'}{s.agenda_sent_at ? ' · agenda sent' : ''}{s.cancel_reason ? ` · ${s.cancel_reason === 'no_agenda' ? 'skipped: no agenda' : s.cancel_reason}` : ''}</small></span>
              <span className="cm-acts">
                {s.status === 'scheduled' ? <Tag tone={future ? 'warn' : ''}>{future ? 'Scheduled' : 'Past'}</Tag> : s.status === 'held' ? <Tag tone="good">Held</Tag> : <Tag tone="bad">Cancelled</Tag>}
                {ed && s.status === 'scheduled' && future && <button type="button" className="lk bad" onClick={() => { if (window.confirm('Cancel this mentor session? The Circle and the mentor are told.')) void act(() => cancelCircleSession(s.id), 'Session cancelled.'); }}>Cancel</button>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── merge and delete ────────────────────────────────────────────────────────
function Danger({ d, others, busy, act, onDeleted }: { d: Detail; others: CircleRow[]; busy: boolean; act: Act; onDeleted: () => void }) {
  const c = d.circle;
  const [into, setInto] = useState('');
  const [name, setName] = useState('');
  return (
    <div className="cm-card cm-danger">
      <h3>Merge or delete</h3>
      <div className="fld">
        <label htmlFor="m-into">Merge into another Circle</label>
        <div className="cm-row">
          <select id="m-into" className="in" style={{ flex: '1 1 200px' }} value={into} onChange={(e) => setInto(e.target.value)} disabled={busy}>
            <option value="">Choose a Circle…</option>
            {others.map((o) => <option key={o.id} value={o.id}>{o.title} ({o.members}/{MAX}, {o.language ?? 'English'})</option>)}
          </select>
          <button type="button" className="btn bs sm-btn" disabled={!into || busy} onClick={() => {
            const t = others.find((o) => o.id === into);
            if (!window.confirm(`Move every member of this Circle into ${t?.title}, and close this one? Members are told.`)) return;
            void act((force) => mergeCircle(c.id, into, { force }), 'Merged. This Circle is now closed.');
          }}>Merge</button>
        </div>
        <span className="sm">The facilitator isn’t moved. The chat and history stay with this Circle.</span>
      </div>
      <div className="fld">
        <label htmlFor="d-name">Delete for good</label>
        <div className="cm-row">
          <input id="d-name" className="in" style={{ flex: '1 1 200px' }} value={name} onChange={(e) => setName(e.target.value)} placeholder={`Type “${c.name}” to confirm`} disabled={busy} />
          <button type="button" className="btn danger sm-btn" disabled={busy || name.trim().toLowerCase() !== c.name.toLowerCase()} onClick={async () => { if (await act(() => deleteCircle(c.id, name), 'Circle deleted.')) onDeleted(); }}>Delete</button>
        </div>
        <span className="sm">Removes the Circle with its chat, calls, agendas and mentor sessions. Closing it is usually enough.</span>
      </div>
    </div>
  );
}
