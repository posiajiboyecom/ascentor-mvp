'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Smartphone } from 'lucide-react';
import { audienceCount, cancelBroadcast, previewEmailHtml, removeCardNow, resumeBroadcast, searchMembers, sendBroadcast, sendTestBroadcast, type MemberHit } from '@/app/admin/broadcasts/actions';
import { AUDIENCE_KINDS, BODY_MAX, PEOPLE_MAX, STAGES, TITLE_MAX, cleanLink, type Audience } from '@/lib/rx/audience';
import NoticeCard from '@/components/rx/NoticeCard';
import { useToast } from '@/components/rx/Toast';

export interface HistoryRow {
  id: string; title: string; channel: 'in_app' | 'email' | 'both'; status: 'draft' | 'sending' | 'sent' | 'cancelled'; pinned: boolean;
  audience: string; total: number | null; inApp: number; emailed: number; failed: number; when: string;
}

const CHANNELS: { value: 'in_app' | 'email' | 'both'; label: string; hint: string }[] = [
  { value: 'in_app', label: 'In the app', hint: 'The bell, and a push where members turned it on.' },
  { value: 'email', label: 'By email', hint: 'From the Ascentor mailbox.' },
  { value: 'both', label: 'Both', hint: 'In the app and by email.' },
];

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

export default function BroadcastsAdmin({ circles, languages, history }: { circles: { id: string; label: string }[]; languages: string[]; history: HistoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [link, setLink] = useState('');
  const [label, setLabel] = useState('');
  const [channel, setChannel] = useState<'in_app' | 'email' | 'both'>('in_app');
  const [kind, setKind] = useState<Audience['kind']>('all');
  const [value, setValue] = useState('');
  const [picked, setPicked] = useState<MemberHit[]>([]);
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<MemberHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [pin, setPin] = useState(false);
  const [until, setUntil] = useState('');
  const [error, setError] = useState('');
  const [count, setCount] = useState<{ total: number; inApp: number; email: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [emailHtml, setEmailHtml] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const audience = useMemo(() => (kind === 'people' ? { kind, ids: picked.map((p) => p.id) } : { kind, value: kind === 'all' ? undefined : value }), [kind, value, picked]);
  const ready = kind === 'all' || (kind === 'people' ? picked.length > 0 : value.trim().length > 0);
  const input = { title, body, linkUrl: link, linkLabel: label, channel, audience, pinCard: pin && channel !== 'email', pinUntil: pin && until ? new Date(`${until}T23:59:00`).toISOString() : null };
  const linkBad = link.trim() !== '' && !cleanLink(link);

  // member search for "Specific people"
  useEffect(() => {
    if (kind !== 'people' || q.trim().length < 2) { setHits([]); setSearching(false); return; }
    setSearching(true);
    const t = setTimeout(() => { void searchMembers(q).then((r) => { setHits(r.ok ? r.hits : []); setSearching(false); }); }, 300);
    return () => clearTimeout(t);
  }, [kind, q]);
  const addPerson = (m: MemberHit) => setPicked((p) => (p.some((x) => x.id === m.id) || p.length >= PEOPLE_MAX ? p : [...p, m]));

  // who this would reach, refreshed shortly after any change
  useEffect(() => {
    setCount(null); setConfirming(false);
    if (!ready) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void audienceCount(audience, channel).then((r) => { if (r.ok) setCount({ total: r.total, inApp: r.inApp, email: r.email }); }); }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [audience, channel, ready]);

  // the email preview, rebuilt as the message is written
  const showEmail = channel !== 'in_app';
  useEffect(() => {
    if (!showEmail || title.trim().length < 3 || body.trim().length < 3 || linkBad) { setEmailHtml(''); return; }
    const t = setTimeout(() => { void previewEmailHtml({ title, body, linkUrl: link, linkLabel: label, channel: 'email', audience: { kind: 'all' } }).then((r) => setEmailHtml(r.ok ? r.html : '')); }, 500);
    return () => clearTimeout(t);
  }, [showEmail, title, body, link, label, linkBad]);

  const preview = { id: 'preview', source: 'broadcast' as const, title: title.trim() || 'Your title appears here', line: (body.trim() || 'The first words of your message appear here.').replace(/\s+/g, ' ').slice(0, 90), href: link.trim() && !linkBad ? link.trim() : null, actionLabel: link.trim() && !linkBad ? label.trim() || 'Open' : null };

  function problem(): string {
    if (title.trim().length < 3) return 'Give the message a title.';
    if (body.trim().length < 3) return 'Write the message.';
    if (linkBad) return 'The link must be a path inside the app, like /community, or a secure https address.';
    if (!ready) return kind === 'people' ? 'Choose at least one member.' : 'Say who it goes to.';
    if (pin && channel === 'email') return 'A sidebar card shows in the app. Choose “In the app” or “Both”.';
    if (pin && !until) return 'Choose the date the card should stay until.';
    return '';
  }

  const send = () => start(async () => {
    const r = await sendBroadcast(input);
    if (!r.ok) { setError(r.error); setConfirming(false); return; }
    toast(r.done ? 'Sent.' : 'Sending. The rest will finish in the background.');
    setTitle(''); setBody(''); setLink(''); setLabel(''); setPin(false); setUntil(''); setConfirming(false); setPicked([]); setQ('');
    router.refresh();
  });

  return (
    <div className="rx-stack-lg">
      <div className="rx-card rx-stack">
        <p className="rx-label">New message</p>

        <div className="rx-fld"><label htmlFor="bc-title">Title</label>
          <input id="bc-title" className="rx-in" value={title} maxLength={TITLE_MAX} onChange={(e) => { setTitle(e.target.value); setError(''); }} placeholder="The Elevation Summit is this Thursday" />
          <span className="rx-sm">{title.length} of {TITLE_MAX}</span></div>

        <div className="rx-fld"><label htmlFor="bc-body">Message</label>
          <textarea id="bc-body" className="rx-in" style={{ minHeight: 120 }} value={body} maxLength={BODY_MAX} onChange={(e) => { setBody(e.target.value); setError(''); }} placeholder="Doors open at 9. Bring your ticket or your name." />
          <span className="rx-sm">{body.length} of {BODY_MAX}</span></div>

        <div className="rx-row rx-nw" style={{ alignItems: 'flex-start' }}>
          <div className="rx-fld" style={{ flex: 2 }}><label htmlFor="bc-link">Link (optional)</label>
            <input id="bc-link" className="rx-in" value={link} onChange={(e) => { setLink(e.target.value); setError(''); }} placeholder="/elevation-summit" aria-invalid={linkBad} />
            {linkBad && <span className="rx-sm" style={{ color: 'var(--rx-danger)' }}>Use a path like /community, or an https address.</span>}</div>
          <div className="rx-fld" style={{ flex: 1 }}><label htmlFor="bc-label">Button label</label>
            <input id="bc-label" className="rx-in" value={label} maxLength={24} onChange={(e) => setLabel(e.target.value)} placeholder="Register" /></div>
        </div>

        <div className="rx-stack-sm">
          <p className="rx-p rx-strong" id="bc-channel">How to send it</p>
          <div className="rx-opts" role="group" aria-labelledby="bc-channel">
            {CHANNELS.map((c) => <button key={c.value} type="button" className="rx-opt" aria-pressed={channel === c.value} onClick={() => { setChannel(c.value); setError(''); }}>{c.label}</button>)}
          </div>
          <span className="rx-sm">{CHANNELS.find((c) => c.value === channel)?.hint}</span>
        </div>

        <div className="rx-stack-sm">
          <p className="rx-p rx-strong" id="bc-aud">Who gets it</p>
          <div className="rx-opts" role="group" aria-labelledby="bc-aud">
            {AUDIENCE_KINDS.map((k) => <button key={k.kind} type="button" className="rx-opt" aria-pressed={kind === k.kind} onClick={() => { setKind(k.kind); setValue(''); }}>{k.label}</button>)}
          </div>
          {kind === 'stage' && <select className="rx-in" aria-label="Stage" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose a stage</option>{STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select>}
          {kind === 'language' && <select className="rx-in" aria-label="Language" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose a language</option>{languages.map((l) => <option key={l} value={l}>{l}</option>)}</select>}
          {kind === 'city' && <input className="rx-in" aria-label="City" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Lagos" />}
          {kind === 'circle' && <select className="rx-in" aria-label="Circle" value={value} onChange={(e) => setValue(e.target.value)}><option value="">Choose a Circle</option>{circles.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}</select>}
          {kind === 'people' && (
            <div className="rx-stack-sm">
              <label className="rx-sm" htmlFor="bc-find">Find a member by name or email</label>
              <input id="bc-find" className="rx-in" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Start typing a name" autoComplete="off" />
              {q.trim().length >= 2 && (
                <ul style={{ listStyle: 'none', margin: 0, padding: 0, border: '1px solid var(--rx-border)', borderRadius: 12, overflow: 'hidden' }} aria-label="Matching members">
                  {searching && <li className="rx-sm" style={{ padding: '10px 12px' }}>Searching…</li>}
                  {!searching && hits.length === 0 && <li className="rx-sm" style={{ padding: '10px 12px' }}>No members found.</li>}
                  {hits.map((m) => {
                    const added = picked.some((x) => x.id === m.id);
                    return (
                      <li key={m.id} className="rx-between" style={{ padding: '8px 12px', borderTop: '1px solid var(--rx-border)' }}>
                        <span style={{ minWidth: 0 }}><span className="rx-p rx-strong" style={{ display: 'block', margin: 0 }}>{m.name}</span><span className="rx-sm">{m.email}</span></span>
                        <button type="button" className="rx-btn secondary" style={{ minHeight: 36, flex: 'none' }} disabled={added || picked.length >= PEOPLE_MAX} onClick={() => addPerson(m)}>{added ? 'Added' : 'Add'}</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {picked.length > 0 && (
                <div className="rx-row" style={{ gap: 6, flexWrap: 'wrap' }} aria-label="Chosen members">
                  {picked.map((m) => (
                    <span key={m.id} className="rx-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {m.name}
                      <button type="button" className="rx-link muted" aria-label={`Remove ${m.name}`} onClick={() => setPicked((p) => p.filter((x) => x.id !== m.id))}>Remove</button>
                    </span>
                  ))}
                </div>
              )}
              <span className="rx-sm">Up to {PEOPLE_MAX} people. Members who muted announcements are skipped, as with any broadcast.</span>
            </div>
          )}
          <p className="rx-sm" aria-live="polite">{!ready ? (kind === 'people' ? 'Choose at least one member.' : 'Choose who it goes to.') : count ? `Reaches ${count.total} ${count.total === 1 ? 'person' : 'people'}${channel !== 'in_app' ? `, ${count.email} by email` : ''}.` : 'Counting…'}</p>
        </div>

        <div className="rx-stack-sm">
          <div className="rx-between"><div><p className="rx-p">Show as a card in the sidebar</p><p className="rx-sm">Stays at the side of the app, and in the phone menu, until the date below.</p></div>
            <button type="button" className="rx-toggle" aria-label="Show as a card" aria-pressed={pin} disabled={channel === 'email'} onClick={() => setPin((p) => !p)} /></div>
          {pin && channel !== 'email' && <div className="rx-fld"><label htmlFor="bc-until">Keep the card until</label><input id="bc-until" type="date" className="rx-in" value={until} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setUntil(e.target.value)} /></div>}
        </div>

        {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}

        {!confirming ? (
          <div className="rx-row">
            <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => { const m = problem(); if (m && m !== 'Say who it goes to.' && m !== 'Choose at least one member.') { setError(m); return; } start(async () => { const r = await sendTestBroadcast(input); toast(r.ok ? 'Test sent to you. Check your bell and your email.' : r.error); }); }}>Send me a test</button>
            <button type="button" className="rx-btn primary" disabled={pending} onClick={() => { const m = problem(); if (m) { setError(m); return; } setError(''); setConfirming(true); }}>Review and send</button>
          </div>
        ) : (
          <div className="rx-soft rx-stack-sm" role="alertdialog" aria-label="Confirm sending">
            <p className="rx-p rx-strong">Send “{title.trim()}” to {count ? `${count.total} ${count.total === 1 ? 'person' : 'people'}` : 'this audience'}?</p>
            <p className="rx-sm">{channel === 'in_app' ? 'In the app' : channel === 'email' ? 'By email' : 'In the app and by email'}{count && channel !== 'in_app' ? ` · ${count.email} emails` : ''}{pin ? ` · card until ${until}` : ''}. This can’t be unsent.</p>
            <div className="rx-row">
              <button type="button" className="rx-btn primary" disabled={pending} onClick={send}>{pending ? 'Sending…' : 'Yes, send it'}</button>
              <button type="button" className="rx-link muted" disabled={pending} onClick={() => setConfirming(false)}>Not yet</button>
            </div>
          </div>
        )}
      </div>

      <div className="rx-card rx-stack">
        <p className="rx-label">What members see</p>
        <div className="rx-stack-sm">
          <p className="rx-sm"><Smartphone aria-hidden style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 6 }} />The card, in the sidebar and the phone menu{pin ? '' : ' (only if you turn the card on)'}</p>
          <div style={{ maxWidth: 300, opacity: pin ? 1 : 0.55 }}><NoticeCard notice={preview} compact preview /></div>
          <p className="rx-sm">The bell</p>
          <div className="rx-rowlink" style={{ maxWidth: 380, border: '1px solid var(--rx-border)', borderRadius: 12, padding: '8px 12px', cursor: 'default' }}>
            <span className="rt"><span className="t" style={{ whiteSpace: 'normal' }}>{preview.title}</span><span className="m" style={{ whiteSpace: 'normal' }}>{body.trim() || 'Your message appears here.'}</span></span>
            <span className="rx-newtag"><span className="rx-dot" />New</span>
          </div>
        </div>
        {showEmail && (
          <div className="rx-stack-sm">
            <p className="rx-sm"><Mail aria-hidden style={{ width: 14, height: 14, verticalAlign: '-2px', marginRight: 6 }} />The email</p>
            {emailHtml
              ? <iframe title="Email preview" srcDoc={emailHtml} sandbox="" style={{ width: '100%', height: 520, border: '1px solid var(--rx-border)', borderRadius: 12, background: '#fff' }} />
              : <p className="rx-sm">Write a title and a message to see the email.</p>}
          </div>
        )}
      </div>

      <div className="rx-card rx-stack">
        <p className="rx-label">Sent so far</p>
        {history.length === 0 && <p className="rx-sm">Nothing sent yet.</p>}
        {history.map((h) => (
          <div key={h.id} className="rx-stack-sm" style={{ paddingBottom: 12, borderBottom: '1px solid var(--rx-border)' }}>
            <div className="rx-between" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0 }}><p className="rx-p rx-strong" style={{ margin: 0 }}>{h.title}</p><p className="rx-sm">{h.audience} · {h.channel === 'in_app' ? 'In the app' : h.channel === 'email' ? 'Email' : 'App and email'} · {when(h.when)}</p></div>
              <span className="rx-tag" style={{ flex: 'none' }}>{h.status === 'sending' ? 'Sending' : h.status === 'sent' ? 'Sent' : h.status === 'cancelled' ? 'Cancelled' : 'Draft'}</span>
            </div>
            <p className="rx-sm">{h.total ?? '…'} people · {h.inApp} in the app · {h.emailed} emailed{h.failed ? ` · ${h.failed} problems` : ''}{h.pinned ? ' · card showing' : ''}</p>
            <div className="rx-row" style={{ gap: 8 }}>
              {h.status === 'sending' && <button type="button" className="rx-btn secondary" style={{ minHeight: 40 }} disabled={pending} onClick={() => start(async () => { const r = await resumeBroadcast(h.id); toast(r.ok ? (r.done ? 'Finished sending.' : `${r.remaining} still to go.`) : r.error); router.refresh(); })}>Continue sending</button>}
              {h.status === 'sending' && <button type="button" className="rx-link muted" disabled={pending} onClick={() => start(async () => { const r = await cancelBroadcast(h.id); toast(r.ok ? 'Stopped. People already sent to keep it.' : r.error); router.refresh(); })}>Stop</button>}
              {h.pinned && <button type="button" className="rx-btn secondary" style={{ minHeight: 40 }} disabled={pending} onClick={() => start(async () => { const r = await removeCardNow(h.id); toast(r.ok ? 'Card removed from the sidebar.' : r.error); router.refresh(); })}>Remove the card now</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
