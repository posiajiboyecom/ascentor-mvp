'use client';

// Write a campaign (or a template): subject, preview text, heading and body in a visual editor or as HTML; choose the
// audience from contact categories and event tags; preview exactly as recipients see it; send a test; send or schedule.
import { useEffect, useRef, useState, useTransition } from 'react';
import {
  audienceCount, previewCampaign, saveCampaign, saveTemplate, scheduleCampaign, sendTestEmail, startCampaign, type Draft,
} from '@/app/admin/c/newsletter/actions';
import { MERGE_FIELDS, MERGE_KEYS, SENDERS, parseSender, type Audience } from '@/lib/email/describe';
import { fmt, type Ctx } from './EmailConsole';

const tagLabel = (t: string) => (t.startsWith('event:') ? t.slice(6) : t);
const MERGE = MERGE_FIELDS;

export default function Composer({ ctx, initial, templateMode, templateId, onClose }: {
  ctx: Ctx; initial: Draft; templateMode?: boolean; templateId?: string; onClose: (openCampaignId?: string) => void;
}) {
  const { overview, canEdit, canSend, me, flash } = ctx;
  const [d, setD] = useState<Draft>(initial);
  const [id, setId] = useState<string | undefined>(initial.id);
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [count, setCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [testTo, setTestTo] = useState(me.email);
  const [schedAt, setSchedAt] = useState('');
  const [emailsText, setEmailsText] = useState(initial.audience.emails.join('\n'));
  const [busy, start] = useTransition();
  const [dirty, setDirty] = useState(false);
  const [tested, setTested] = useState(false);
  const editor = useRef<HTMLDivElement>(null);
  const ro = !canEdit;

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => { setD((x) => ({ ...x, [k]: v })); setDirty(true); };
  const setAud = (a: Partial<Audience>) => set('audience', { ...d.audience, ...a });

  // Visual editor holds its own DOM; seed it once, and again after editing the HTML directly.
  useEffect(() => { if (mode === 'visual' && editor.current && editor.current.innerHTML !== d.body_html) editor.current.innerHTML = d.body_html; }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Live audience size.
  useEffect(() => {
    if (templateMode) return;
    const t = setTimeout(async () => { const r = await audienceCount(d.audience); setCount(r.ok ? r.count : null); }, 350);
    return () => clearTimeout(t);
  }, [d.audience, templateMode]);

  // Preview refreshes a moment after typing stops.
  useEffect(() => {
    const t = setTimeout(async () => { const r = await previewCampaign(d); if (r.ok) setPreview(r.html); }, 700);
    return () => clearTimeout(t);
  }, [d]);

  const exec = (cmd: string, val?: string) => { if (ro) return; editor.current?.focus(); document.execCommand(cmd, false, val); syncFromEditor(); };
  const insertHtml = (html: string) => exec('insertHTML', html);
  const syncFromEditor = () => { if (editor.current) set('body_html', editor.current.innerHTML); };
  const askUrl = (label: string, initialValue = 'https://') => { const u = window.prompt(label, initialValue)?.trim(); return u && (/^(https?:\/\/|mailto:)/i.test(u) || /^\{\{\s*referral_link\s*\}\}$/i.test(u)) ? u : null; };
  const escAttr = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  async function persist(): Promise<string | null> {
    if (templateMode) {
      const r = await saveTemplate({ id: templateId, name: d.name, subject: d.subject, preheader: d.preheader, body_html: d.body_html });
      if (!r.ok) { flash(r.error, true); return null; }
      setDirty(false); return r.id;
    }
    const r = await saveCampaign({ ...d, id });
    if (!r.ok) { flash(r.error, true); return null; }
    setId(r.id); setDirty(false); return r.id;
  }

  const save = () => start(async () => { const sid = await persist(); if (sid) flash(templateMode ? 'Template saved.' : 'Draft saved.'); });
  const test = () => start(async () => { const r = await sendTestEmail(d, testTo); if (r.ok) setTested(true); flash(r.ok ? `Test sent to ${r.to}.` : r.error, !r.ok); });
  const send = () => start(async () => {
    if (!count) { flash('Nobody in this audience can be emailed yet.', true); return; }
    const days = Math.ceil(count / Math.max(1, overview.settings.daily_limit));
    if (!window.confirm(`Send “${d.subject}” to ${fmt(count)} ${count === 1 ? 'person' : 'people'}?${days > 1 ? `\n\nAt your daily limit of ${fmt(overview.settings.daily_limit)}, this takes about ${days} days to finish.` : ''}`)) return;
    const sid = await persist(); if (!sid) return;
    const r = await startCampaign(sid);
    if (!r.ok) { flash(r.error, true); return; }
    flash(`Sending to ${fmt(r.total)} ${r.total === 1 ? 'person' : 'people'}.`);
    onClose(sid);
  });
  const schedule = () => start(async () => {
    if (!schedAt) { flash('Pick a date and time first.', true); return; }
    const sid = await persist(); if (!sid) return;
    const r = await scheduleCampaign(sid, new Date(schedAt).toISOString());
    if (!r.ok) { flash(r.error, true); return; }
    flash(`Scheduled for ${new Date(schedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}.`);
    onClose(sid);
  });
  const back = () => { if (dirty && canEdit && !window.confirm('Leave without saving your changes?')) return; onClose(); };

  const srcs = overview.sources.filter((s) => s.total > 0 || d.audience.sources.includes(s.key));
  const toggle = (list: string[], k: string) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const days = count ? Math.ceil(count / Math.max(1, overview.settings.daily_limit)) : 0;
  // Gentle pre-flight notes. They never block sending: they are the things that most often go wrong.
  const unknownFields = [...new Set([...(d.body_html + ' ' + d.subject + ' ' + d.heading).matchAll(/\{\{\s*([a-z_]+)\s*\}\}/gi)].map((m) => m[1].toLowerCase()))].filter((f) => !MERGE_KEYS.includes(f));
  const notes = [
    d.subject.length > 60 ? `The subject is ${d.subject.length} characters. Most inboxes cut it off after about 60.` : '',
    !d.preheader.trim() ? 'No preview text. Inboxes will show the first words of the email instead.' : '',
    unknownFields.length ? `${unknownFields.map((f) => `{{${f}}}`).join(', ')} is not a personal field and will be sent as typed.` : '',
    !/href=/i.test(d.body_html) ? 'There is no link in the email.' : '',
    !tested ? 'You have not sent yourself a test yet.' : '',
  ].filter(Boolean);

  return (
    <div className="st">
      <div className="sb" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="lk" onClick={back}>← {templateMode ? 'Templates' : 'Campaigns'}</button>
        <div className="row">
          {canEdit && <button type="button" className="btn bs" disabled={busy} onClick={save}>{busy ? 'Saving…' : templateMode ? 'Save template' : 'Save draft'}</button>}
          {canEdit && !templateMode && <button type="button" className="btn bs" disabled={busy} onClick={() => start(async () => { const r = await saveTemplate({ name: d.name || d.subject, subject: d.subject, preheader: d.preheader, body_html: d.body_html }); flash(r.ok ? 'Saved as a template.' : r.error, !r.ok); })}>Save as template</button>}
        </div>
      </div>

      <div className="em-compose">
        <div className="st">
          <div className="card st">
            <div className="fld"><label htmlFor="em-name">{templateMode ? 'Template name' : 'Campaign name'} <span className="sm">(only you see this)</span></label><input id="em-name" className="in" value={d.name} disabled={ro} onChange={(e) => set('name', e.target.value)} placeholder={templateMode ? 'e.g. Event invitation' : 'e.g. Summit reminder, 18 Nov'} /></div>
            <div className="fld"><label htmlFor="em-subject">Subject</label><input id="em-subject" className="in" value={d.subject} disabled={ro} maxLength={200} onChange={(e) => set('subject', e.target.value)} placeholder="What people see in their inbox" /></div>
            <div className="fld"><label htmlFor="em-pre">Preview text <span className="sm">(shown after the subject in most inboxes)</span></label><input id="em-pre" className="in" value={d.preheader} disabled={ro} maxLength={200} onChange={(e) => set('preheader', e.target.value)} placeholder="A line that makes people open it" /></div>
            {!templateMode && (
              <div className="fld">
                <label htmlFor="em-sender">From</label>
                <select id="em-sender" className="in" value={parseSender(d.sender)} disabled={ro} onChange={(e) => set('sender', parseSender(e.target.value))}>
                  {SENDERS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>
                <span className="sm">{SENDERS.find((s) => s.key === parseSender(d.sender))?.help}. Replies go to this address.</span>
              </div>
            )}
            {!templateMode && <div className="fld"><label htmlFor="em-head">Heading <span className="sm">(big title at the top of the email; optional)</span></label><input id="em-head" className="in" value={d.heading} disabled={ro} maxLength={200} onChange={(e) => set('heading', e.target.value)} placeholder="e.g. See you on Thursday, {{first_name}}" /></div>}
          </div>

          <div>
            <div className="em-toolbar" role="toolbar" aria-label="Formatting">
              <button type="button" className={mode === 'visual' ? 'on' : ''} onClick={() => { if (mode === 'html') setMode('visual'); }} aria-pressed={mode === 'visual'}>Visual</button>
              <button type="button" onClick={() => { syncFromEditor(); setMode('html'); }} aria-pressed={mode === 'html'}>HTML</button>
              <span className="sep" />
              {mode === 'visual' && !ro && (<>
                <button type="button" title="Bold" onMouseDown={(e) => { e.preventDefault(); exec('bold'); }}><b>B</b></button>
                <button type="button" title="Italic" onMouseDown={(e) => { e.preventDefault(); exec('italic'); }}><i>I</i></button>
                <button type="button" title="Underline" onMouseDown={(e) => { e.preventDefault(); exec('underline'); }}><u>U</u></button>
                <button type="button" title="Heading" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'h2'); }}>H2</button>
                <button type="button" title="Subheading" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'h3'); }}>H3</button>
                <button type="button" title="Paragraph" onMouseDown={(e) => { e.preventDefault(); exec('formatBlock', 'p'); }}>¶</button>
                <button type="button" title="Bulleted list" onMouseDown={(e) => { e.preventDefault(); exec('insertUnorderedList'); }}>• List</button>
                <button type="button" title="Numbered list" onMouseDown={(e) => { e.preventDefault(); exec('insertOrderedList'); }}>1. List</button>
                <span className="sep" />
                <button type="button" title="Link" onMouseDown={(e) => { e.preventDefault(); const u = askUrl('Link to (https://…)'); if (u) exec('createLink', u); }}>Link</button>
                <button type="button" title="Button" onMouseDown={(e) => {
                  e.preventDefault();
                  const label = window.prompt('Button text', 'Register now')?.trim(); if (!label) return;
                  const u = askUrl('Button link (https://… or {{referral_link}})'); if (!u) return;
                  insertHtml(`<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 18px;"><tr><td style="background:#B6502A;border-radius:8px;"><a href="${escAttr(u)}" style="display:inline-block;padding:12px 22px;color:#ffffff;font-weight:bold;text-decoration:none;font-family:Arial,Helvetica,sans-serif;">${escAttr(label)}</a></td></tr></table><p></p>`);
                }}>Button</button>
                <button type="button" title="Image" onMouseDown={(e) => { e.preventDefault(); const u = window.prompt('Image address (must start with https://)', 'https://')?.trim(); if (u && /^https:\/\//i.test(u)) insertHtml(`<img src="${escAttr(u)}" alt="" style="max-width:100%;height:auto;border-radius:8px;" /><p></p>`); }}>Image</button>
                <button type="button" title="Divider" onMouseDown={(e) => { e.preventDefault(); insertHtml('<hr style="border:0;border-top:1px solid #E8E6E1;margin:20px 0;" /><p></p>'); }}>—</button>
                <span className="sep" />
                <select aria-label="Insert a personal field" value="" onChange={(e) => { if (e.target.value) exec('insertText', e.target.value); }}>
                  <option value="">Insert field…</option>
                  {MERGE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </>)}
            </div>
            {mode === 'visual'
              ? <div ref={editor} className="em-editor" contentEditable={!ro} suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Email body" data-placeholder="Write your message. Use “Insert field…” to greet each person by name." onInput={syncFromEditor} onBlur={syncFromEditor} />
              : <textarea className="in em-html" value={d.body_html} disabled={ro} onChange={(e) => set('body_html', e.target.value)} aria-label="Email body HTML" spellCheck={false} />}
            <p className="sm" style={{ marginTop: 6 }}>Personal fields: {MERGE.map(([v]) => <span key={v} className="em-mono" style={{ marginRight: 8 }}>{v}</span>)}· unknown first names become “there”; {'{{referral_link}}'} becomes each Summit registrant’s own link (the Summit page for everyone else). Scripts and unsafe links are removed when sending.</p>
          </div>

          {!templateMode && (
            <div className="card st">
              <div className="sb"><p className="h3">Who gets it</p><span className="tag warn"><i />{count == null ? 'Counting…' : `${fmt(count)} ${count === 1 ? 'person' : 'people'}`}</span></div>
              <div className="setrow" style={{ paddingTop: 0 }}>
                <span>Everyone in Contacts<span className="sm" style={{ display: 'block' }}>{fmt(overview.reachable)} reachable. Unsubscribed and bounced addresses are always left out.</span></span>
                <button type="button" className={`toggle${d.audience.all ? ' on' : ''}${ro ? ' lock' : ''}`} aria-pressed={d.audience.all} aria-label="Send to all contacts" disabled={ro} onClick={() => setAud({ all: !d.audience.all })} />
              </div>
              {!d.audience.all && (<>
                <p className="sm">Or choose categories (anyone in any of them):</p>
                <div className="opts">
                  {srcs.map((s) => (
                    <button key={s.key} type="button" disabled={ro} title={s.help} className={`em-chip${d.audience.sources.includes(s.key) ? ' on' : ''}`} aria-pressed={d.audience.sources.includes(s.key)} onClick={() => setAud({ sources: toggle(d.audience.sources, s.key) })}>
                      {s.label}<span className="c">{fmt(s.reachable)}</span>
                    </button>
                  ))}
                </div>
                {overview.tags.length > 0 && (<>
                  <p className="sm">Events and tags:</p>
                  <div className="opts">
                    {overview.tags.map((t) => (
                      <button key={t.tag} type="button" disabled={ro} className={`em-chip${d.audience.tags.includes(t.tag) ? ' on' : ''}`} aria-pressed={d.audience.tags.includes(t.tag)} onClick={() => setAud({ tags: toggle(d.audience.tags, t.tag) })}>
                        {tagLabel(t.tag)}<span className="c">{fmt(t.total)}</span>
                      </button>
                    ))}
                  </div>
                </>)}
                <div className="fld">
                  <label htmlFor="em-emails">Specific addresses <span className="sm">(optional, one per line)</span></label>
                  <textarea id="em-emails" className="in" rows={3} style={{ padding: 10, minHeight: 70 }} disabled={ro} value={emailsText}
                    onChange={(e) => { setEmailsText(e.target.value); setAud({ emails: e.target.value.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter((x) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)) }); }}
                    placeholder="name@example.com" />
                </div>
              </>)}
              <details>
                <summary className="sm" style={{ cursor: 'pointer' }}>Leave out a category{d.audience.exclude.length ? ` (${d.audience.exclude.length})` : ''}</summary>
                <div className="opts" style={{ marginTop: 8 }}>
                  {srcs.map((s) => (
                    <button key={s.key} type="button" disabled={ro} className={`em-chip ex${d.audience.exclude.includes(s.key) ? ' on' : ''}`} aria-pressed={d.audience.exclude.includes(s.key)} onClick={() => setAud({ exclude: toggle(d.audience.exclude, s.key) })}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </details>
            </div>
          )}
        </div>

        <div className="em-sticky">
          <div className="card st">
            <p className="h3">Preview</p>
            <p className="sm">Exactly as recipients see it, shown with your name. Links are tracked and the unsubscribe link works in the real send.</p>
            <iframe className="em-frame sm" title="Email preview" sandbox="" srcDoc={preview || '<p style="font-family:Arial;padding:20px;color:#6B7280">Preview appears here.</p>'} />
          </div>
          {canEdit && (
            <div className="card st">
              <p className="h3">Send a test</p>
              <div className="row" style={{ flexWrap: 'nowrap' }}>
                <input className="in" type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} aria-label="Test address" />
                <button type="button" className="btn bs" disabled={busy || !d.subject} onClick={test}>Send test</button>
              </div>
            </div>
          )}
          {!templateMode && (
            <div className="card st">
              <p className="h3">Send</p>
              {!canSend ? <p className="sm">Your role can draft and test campaigns. A teammate with full email access sends them.</p> : (<>
                <p className="sm">
                  {count ? <>Goes to <b>{fmt(count)}</b> {count === 1 ? 'person' : 'people'} at about {overview.settings.per_minute} a minute, up to {fmt(overview.settings.daily_limit)} in any 24 hours{days > 1 ? <>, so it finishes in about <b>{days} days</b></> : null}.</> : 'Choose who gets it to see how long it takes.'}
                </p>
                {notes.length > 0 && (
                  <ul className="sm" aria-label="Before you send" style={{ margin: '0 0 10px', paddingLeft: 18 }}>
                    {notes.map((n) => <li key={n}>{n}</li>)}
                  </ul>
                )}
                <button type="button" className="btn bp" disabled={busy || !count || !d.subject} onClick={send}>{busy ? 'Working…' : 'Send now'}</button>
                <div className="fld">
                  <label htmlFor="em-when">Or schedule for later</label>
                  <div className="row" style={{ flexWrap: 'nowrap' }}>
                    <input id="em-when" className="in" type="datetime-local" value={schedAt} onChange={(e) => setSchedAt(e.target.value)} />
                    <button type="button" className="btn bs" disabled={busy || !count || !d.subject || !schedAt} onClick={schedule}>Schedule</button>
                  </div>
                  <span className="sm">In your own time zone.</span>
                </div>
              </>)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
