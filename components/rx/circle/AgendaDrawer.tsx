'use client';

// Circle agenda, prepared before the call. Any member can add, reorder and delete items. Each item has a title and an
// optional duration in minutes. Edits save on their own (on change after a short pause, and on blur); there is no
// Save button. Other members' edits arrive live. The weekly call shows the most recent agenda.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, ListChecks, Plus, Trash2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { ago, loadAgenda, type Agenda, type AgendaItem } from '@/lib/rx/agenda';

type Draft = Pick<AgendaItem, 'title' | 'duration_minutes'>;
const DEBOUNCE_MS = 700;

export function AgendaDrawer({ circleId, meId }: { circleId: string; meId: string }) {
  const sb = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [agenda, setAgenda] = useState<Agenda | null>(null);
  const [items, setItems] = useState<AgendaItem[]>([]);
  const [editor, setEditor] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const drafts = useRef(new Map<string, Draft>());            // unsaved edits, by item id
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const reload = useCallback(async () => {
    const r = await loadAgenda(sb, circleId);
    setAgenda(r.agenda);
    setEditor(r.editorName);
    // Keep whatever the member is typing; take everyone else's changes.
    setItems(r.items.map((it) => { const d = drafts.current.get(it.id); return d ? { ...it, ...d } : it; }));
    setLoaded(true);
  }, [sb, circleId]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);

  // Live updates from other members while the drawer is open.
  const agendaId = agenda?.id;
  useEffect(() => {
    if (!open) return;
    let ch = sb.channel(`agenda:${circleId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'circle_agendas', filter: `circle_id=eq.${circleId}` }, () => { void reload(); });
    if (agendaId) ch = ch.on('postgres_changes', { event: '*', schema: 'public', table: 'agenda_items', filter: `agenda_id=eq.${agendaId}` }, () => { void reload(); });
    ch.subscribe();
    return () => { void sb.removeChannel(ch); };
  }, [open, sb, circleId, agendaId, reload]);

  const mark = (p: PromiseLike<{ error: unknown }>) => {
    setStatus('saving');
    return Promise.resolve(p).then(({ error }) => { setStatus(error ? 'error' : 'saved'); if (!error) setEditor('You'); return !error; });
  };

  async function ensureAgenda(): Promise<Agenda | null> {
    if (agenda) return agenda;
    const { data, error } = await sb.from('circle_agendas').insert({ circle_id: circleId, created_by: meId, updated_by: meId })
      .select('id, circle_id, current_item_index, current_item_started_at, updated_at, updated_by').single();
    if (error || !data) { setStatus('error'); return null; }
    setAgenda(data as Agenda);
    return data as Agenda;
  }

  async function addItem() {
    const a = await ensureAgenda();
    if (!a) return;
    const position = items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
    setStatus('saving');
    const { data, error } = await sb.from('agenda_items').insert({ agenda_id: a.id, position, title: '', duration_minutes: null, created_by: meId })
      .select('id, position, title, duration_minutes').single();
    if (error || !data) { setStatus('error'); return; }
    setStatus('saved'); setEditor('You');
    setItems((xs) => [...xs, data as AgendaItem]);
    requestAnimationFrame(() => document.getElementById(`agenda-title-${(data as AgendaItem).id}`)?.focus());
  }

  function flush(id: string) {
    const t = timers.current.get(id); if (t) { clearTimeout(t); timers.current.delete(id); }
    const d = drafts.current.get(id); if (!d) return;
    drafts.current.delete(id);
    void mark(sb.from('agenda_items').update({ title: d.title.slice(0, 200), duration_minutes: d.duration_minutes }).eq('id', id));
  }

  function edit(id: string, patch: Partial<Draft>) {
    setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const cur = items.find((x) => x.id === id);
    if (!cur) return;
    drafts.current.set(id, { title: cur.title, duration_minutes: cur.duration_minutes, ...drafts.current.get(id), ...patch });
    const t = timers.current.get(id); if (t) clearTimeout(t);
    timers.current.set(id, setTimeout(() => flush(id), DEBOUNCE_MS));
  }

  async function move(id: string, dir: -1 | 1) {
    const i = items.findIndex((x) => x.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= items.length) return;
    const next = [...items];
    [next[i], next[j]] = [next[j], next[i]];
    const renumbered = next.map((x, k) => ({ ...x, position: k }));
    setItems(renumbered);
    const changed = renumbered.filter((x, k) => items[k]?.id !== x.id || items[k]?.position !== x.position);
    await mark(Promise.all(changed.map((x) => sb.from('agenda_items').update({ position: x.position }).eq('id', x.id)))
      .then((rs) => ({ error: rs.find((r) => r.error)?.error ?? null })));
  }

  async function remove(id: string) {
    const t = timers.current.get(id); if (t) clearTimeout(t);
    timers.current.delete(id); drafts.current.delete(id);
    setItems((xs) => xs.filter((x) => x.id !== id));
    await mark(sb.from('agenda_items').delete().eq('id', id));
  }

  async function startFresh() {
    if (!window.confirm('Start a new, empty agenda for the next call? The current one is kept in the history.')) return;
    const { data, error } = await sb.from('circle_agendas').insert({ circle_id: circleId, created_by: meId, updated_by: meId })
      .select('id, circle_id, current_item_index, current_item_started_at, updated_at, updated_by').single();
    if (error || !data) { setStatus('error'); return; }
    drafts.current.clear();
    setAgenda(data as Agenda); setItems([]); setEditor('You'); setStatus('saved');
  }

  function close() {
    for (const id of [...drafts.current.keys()]) flush(id);
    setOpen(false);
  }

  const total = items.reduce((n, x) => n + (x.duration_minutes ?? 0), 0);
  const lastLine = agenda ? `Last updated by ${editor ?? 'a member'} · ${ago(agenda.updated_at, now)}` : 'No agenda yet';

  return (
    <>
      <div className="rx-card rx-stack-sm">
        <div className="rx-between"><p className="rx-label">Call agenda</p><span className="rx-sm">{loaded ? `${items.length} ${items.length === 1 ? 'item' : 'items'}${total ? ` · ${total} min` : ''}` : ''}</span></div>
        {loaded && items.length > 0 && (
          <ol className="rx-agenda-preview">
            {items.slice(0, 4).map((it) => <li key={it.id}><span>{it.title || 'Untitled item'}</span>{it.duration_minutes ? <span className="rx-sm">{it.duration_minutes} min</span> : null}</li>)}
            {items.length > 4 && <li className="rx-sm">+{items.length - 4} more</li>}
          </ol>
        )}
        <p className="rx-sm">{loaded ? lastLine : 'Loading…'}</p>
        <div><button type="button" className="rx-btn secondary" onClick={() => setOpen(true)}><ListChecks aria-hidden style={{ width: 18, height: 18 }} />{items.length ? 'Edit agenda' : 'Prepare the agenda'}</button></div>
      </div>

      {open && (
        <>
          <div className="rx-scrim" onClick={close} aria-hidden />
          <div className="rx-sheet rx-agenda-sheet" role="dialog" aria-modal="true" aria-labelledby="agenda-title">
            <div className="grab" aria-hidden />
            <div className="rx-between">
              <p id="agenda-title" className="rx-h3">Agenda for the next call</p>
              <button type="button" className="rx-ib" aria-label="Close agenda" onClick={close}><X aria-hidden /></button>
            </div>
            <p className="rx-sm" aria-live="polite">
              {lastLine}
              {status === 'saving' ? ' · Saving…' : status === 'saved' ? ' · Saved' : status === 'error' ? ' · Couldn’t save. Check your connection.' : ''}
            </p>

            <ol className="rx-agenda-edit">
              {items.map((it, i) => (
                <li key={it.id}>
                  <span className="n" aria-hidden>{i + 1}</span>
                  <input
                    id={`agenda-title-${it.id}`}
                    className="rx-in"
                    value={it.title}
                    maxLength={200}
                    placeholder="What will you cover?"
                    aria-label={`Item ${i + 1} title`}
                    onChange={(e) => edit(it.id, { title: e.target.value })}
                    onBlur={() => flush(it.id)}
                  />
                  <input
                    className="rx-in min"
                    inputMode="numeric"
                    value={it.duration_minutes ?? ''}
                    placeholder="min"
                    aria-label={`Item ${i + 1} duration in minutes (optional)`}
                    onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 3); const n = v ? Math.min(240, Math.max(1, Number(v))) : null; edit(it.id, { duration_minutes: n }); }}
                    onBlur={() => flush(it.id)}
                  />
                  <span className="acts">
                    <button type="button" className="rx-ib" aria-label={`Move item ${i + 1} up`} disabled={i === 0} onClick={() => void move(it.id, -1)}><ArrowUp aria-hidden /></button>
                    <button type="button" className="rx-ib" aria-label={`Move item ${i + 1} down`} disabled={i === items.length - 1} onClick={() => void move(it.id, 1)}><ArrowDown aria-hidden /></button>
                    <button type="button" className="rx-ib" aria-label={`Delete item ${i + 1}`} onClick={() => void remove(it.id)}><Trash2 aria-hidden /></button>
                  </span>
                </li>
              ))}
            </ol>
            {items.length === 0 && <p className="rx-p" style={{ color: 'var(--rx-muted)' }}>Nothing on the agenda yet. Add the first item and your Circle will see it here and during the call.</p>}

            <div className="rx-row" style={{ marginTop: 12 }}>
              <button type="button" className="rx-btn primary" onClick={() => void addItem()}><Plus aria-hidden style={{ width: 18, height: 18 }} />Add item</button>
              {agenda && items.length > 0 && <button type="button" className="rx-link muted" onClick={() => void startFresh()}>Start a new agenda</button>}
            </div>
            {total > 0 && <p className="rx-sm" style={{ marginTop: 8 }}>Planned time: {total} min. The weekly call is 15 minutes.</p>}
          </div>
        </>
      )}
    </>
  );
}
