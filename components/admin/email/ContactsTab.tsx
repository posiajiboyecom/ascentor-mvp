'use client';

// Every address Ascentor has collected, grouped by where it came from. Filter by category, event tag or status;
// open a contact to see their categories and email history; add, import, export; unsubscribe or resubscribe.
import { useCallback, useEffect, useState, useTransition } from 'react';
import {
  addContact, contactDetail, exportContacts, importContacts, listContacts, setSubscribed, syncContacts,
  type ContactDetail, type ContactQuery, type ContactRow,
} from '@/app/admin/c/newsletter/actions';
import { sourceLabel, tagLabel } from '@/lib/email/describe';
import { fmt, when, type Ctx } from './EmailConsole';

export default function ContactsTab({ ctx }: { ctx: Ctx }) {
  const { overview, canEdit, canSend, flash, refresh } = ctx;
  const [f, setF] = useState<ContactQuery>({ status: 'all', page: 0 });
  const [qText, setQText] = useState('');
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<ContactDetail | null>(null);
  const [modal, setModal] = useState<null | 'add' | 'import'>(null);
  const [busy, start] = useTransition();

  const load = useCallback(async (q: ContactQuery) => {
    setLoading(true);
    const r = await listContacts(q);
    setLoading(false);
    if (r.ok) { setRows(r.rows); setTotal(r.total); setPageSize(r.pageSize); } else flash(r.error, true);
  }, [flash]);
  useEffect(() => { void load(f); }, [f, load]);
  useEffect(() => { const t = setTimeout(() => setF((x) => (x.q === qText ? x : { ...x, q: qText, page: 0 })), 350); return () => clearTimeout(t); }, [qText]);

  const openContact = (email: string) => start(async () => { const r = await contactDetail(email); if (r.ok) setOpen(r.contact); else flash(r.error, true); });
  const sync = () => start(async () => { const r = await syncContacts(); if (r.ok) { flash(r.added ? `${fmt(r.added)} new contacts found. ${fmt(r.total)} in total.` : `Up to date. ${fmt(r.total)} contacts.`); await refresh(); await load(f); } else flash(r.error, true); });
  const doExport = () => start(async () => {
    const r = await exportContacts(f);
    if (!r.ok) { flash(r.error, true); return; }
    const url = URL.createObjectURL(new Blob([r.csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `ascentor-contacts-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
    flash(`Exported ${fmt(r.count)} contacts.`);
  });

  const cats = overview.sources.filter((s) => s.total > 0);
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const page = f.page ?? 0;

  return (
    <div className="st">
      <div className="sb" style={{ flexWrap: 'wrap' }}>
        <p className="sm" style={{ maxWidth: 640 }}>Contacts are gathered automatically from every form and sale: newsletter, Summit and event registrations, the shop, the app and more. Refresh to pull in anyone new.</p>
        <div className="row">
          {canEdit && <button type="button" className="btn bs" disabled={busy} onClick={sync}>Refresh contacts</button>}
          {canEdit && <button type="button" className="btn bs" onClick={() => setModal('add')}>Add contact</button>}
          {canSend && <button type="button" className="btn bs" onClick={() => setModal('import')}>Import CSV</button>}
          {canSend && <button type="button" className="btn bs" disabled={busy} onClick={doExport}>Export</button>}
        </div>
      </div>

      <div className="em-cats">
        <button type="button" className={`em-cat${!f.source ? ' on' : ''}`} onClick={() => setF({ ...f, source: undefined, page: 0 })} aria-pressed={!f.source}>
          <b>{fmt(overview.contacts)}</b><span>All contacts</span><small>{fmt(overview.reachable)} reachable</small>
        </button>
        {cats.map((s) => (
          <button key={s.key} type="button" title={s.help} className={`em-cat${f.source === s.key ? ' on' : ''}`} aria-pressed={f.source === s.key} onClick={() => setF({ ...f, source: f.source === s.key ? undefined : s.key, page: 0 })}>
            <b>{fmt(s.total)}</b><span>{s.label}</span><small>{fmt(s.reachable)} reachable</small>
          </button>
        ))}
      </div>

      <div className="row" style={{ flexWrap: 'wrap' }}>
        <input className="in" style={{ maxWidth: 320 }} type="search" placeholder="Search name, email or phone" value={qText} onChange={(e) => setQText(e.target.value)} aria-label="Search contacts" />
        {overview.tags.length > 0 && (
          <select className="in" style={{ maxWidth: 260 }} value={f.tag ?? ''} onChange={(e) => setF({ ...f, tag: e.target.value || undefined, page: 0 })} aria-label="Filter by event or tag">
            <option value="">Any event or tag</option>
            {overview.tags.map((t) => <option key={t.tag} value={t.tag}>{tagLabel(t.tag)} ({fmt(t.total)})</option>)}
          </select>
        )}
        <div className="seg3" role="group" aria-label="Status">
          {(['all', 'reachable', 'unsubscribed', 'bounced'] as const).map((k) => (
            <button key={k} type="button" className={f.status === k ? 'on' : ''} aria-pressed={f.status === k} onClick={() => setF({ ...f, status: k, page: 0 })}>{k[0].toUpperCase() + k.slice(1)}</button>
          ))}
        </div>
      </div>

      <div className="tblwrap"><table className="tbl">
        <thead><tr><th>Contact</th><th>Categories</th><th>Phone</th><th>Last seen</th><th>Status</th></tr></thead>
        <tbody>
          {loading && rows.length === 0 && <tr><td colSpan={5} className="sm">Loading…</td></tr>}
          {!loading && rows.length === 0 && <tr><td colSpan={5}><div className="empty"><p className="sm">No contacts match.{overview.contacts === 0 ? ' Press “Refresh contacts” to gather them.' : ''}</p></div></td></tr>}
          {rows.map((r) => (
            <tr key={r.email}>
              <td><button type="button" className="rowbtn" onClick={() => openContact(r.email)}>{r.name || r.email}</button>{r.name && <span className="sm em-mono" style={{ display: 'block' }}>{r.email}</span>}</td>
              <td><div className="em-tagset">{r.sources.map((s) => <span key={s} className="tag">{sourceLabel(s)}</span>)}{r.tags.slice(0, 2).map((t) => <span key={t} className="tag warn"><i />{tagLabel(t)}</span>)}{r.tags.length > 2 && <span className="sm">+{r.tags.length - 2}</span>}</div></td>
              <td className="sm">{r.phone ?? '–'}</td>
              <td className="sm">{when(r.last_seen_at)}</td>
              <td>{r.unsubscribed_at ? <span className="tag bad"><i />Unsubscribed</span> : r.bounced_at ? <span className="tag bad"><i />Bounced</span> : <span className="tag good"><i />Reachable</span>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
      <div className="em-pager">
        <span>{fmt(total)} {total === 1 ? 'contact' : 'contacts'}{total > pageSize ? ` · page ${page + 1} of ${fmt(pages)}` : ''}</span>
        {total > pageSize && <div className="row"><button type="button" className="btn bs sm-btn" disabled={page === 0} onClick={() => setF({ ...f, page: page - 1 })}>Previous</button><button type="button" className="btn bs sm-btn" disabled={page + 1 >= pages} onClick={() => setF({ ...f, page: page + 1 })}>Next</button></div>}
      </div>

      {open && <ContactDrawer c={open} ctx={ctx} onClose={() => setOpen(null)} onChanged={async () => { const r = await contactDetail(open.email); if (r.ok) setOpen(r.contact); await load(f); await refresh(); }} />}
      {modal === 'add' && <AddModal ctx={ctx} onClose={async (changed) => { setModal(null); if (changed) { await load(f); await refresh(); } }} />}
      {modal === 'import' && <ImportModal ctx={ctx} onClose={async (changed) => { setModal(null); if (changed) { await load(f); await refresh(); } }} />}
    </div>
  );
}

function ContactDrawer({ c, ctx, onClose, onChanged }: { c: ContactDetail; ctx: Ctx; onClose: () => void; onChanged: () => Promise<void> }) {
  const [busy, start] = useTransition();
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  const toggle = (sub: boolean) => start(async () => { const r = await setSubscribed(c.email, sub); if (r.ok) { ctx.flash(sub ? 'Resubscribed.' : 'Unsubscribed. They won’t get campaigns.'); await onChanged(); } else ctx.flash(r.error, true); });
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={c.name || c.email}>
        <div className="dhead">
          <div style={{ flex: 1, minWidth: 0 }}><p className="h3" style={{ margin: 0 }}>{c.name || c.email}</p><p className="sm em-mono" style={{ margin: '2px 0 0', overflowWrap: 'anywhere' }}>{c.email}</p></div>
          <button type="button" className="btn bs sm-btn" onClick={onClose}>Close</button>
        </div>
        <div className="dbody">
          <dl className="kv">
            <dt>Status</dt><dd>{c.unsubscribed_at ? `Unsubscribed ${when(c.unsubscribed_at)}${c.unsubscribe_source ? ` (${({ link: 'from an email', one_click: 'one-click in their inbox', admin: 'by a teammate', newsletter: 'from the old newsletter', deletion_request: 'data deletion request' } as Record<string, string>)[c.unsubscribe_source] ?? c.unsubscribe_source})` : ''}` : c.bounced_at ? `Bounced ${when(c.bounced_at)}` : 'Reachable'}</dd>
            {c.bounce_reason && (<><dt>Bounce</dt><dd className="sm">{c.bounce_reason}</dd></>)}
            <dt>Phone</dt><dd>{c.phone ?? '–'}</dd>
            <dt>First seen</dt><dd>{when(c.first_seen_at)}</dd>
            <dt>Last seen</dt><dd>{when(c.last_seen_at)}</dd>
          </dl>
          <div className="st" style={{ gap: 8 }}>
            <p className="h3" style={{ margin: 0 }}>How we got this contact</p>
            {c.sources.map((s) => <div key={s} className="sb"><span>{sourceLabel(s)}</span><span className="sm">{c.source_seen?.[s] ? when(c.source_seen[s]) : ''}</span></div>)}
            {c.tags.length > 0 && <div className="em-tagset">{c.tags.map((t) => <span key={t} className="tag warn"><i />{tagLabel(t)}</span>)}</div>}
          </div>
          <div className="st" style={{ gap: 8 }}>
            <p className="h3" style={{ margin: 0 }}>Emails sent</p>
            {c.history.length === 0 ? <p className="sm">No campaigns sent to this address yet.</p> : c.history.map((h, i) => (
              <div key={i} className="sb"><span>{h.campaign}<span className="sm" style={{ display: 'block' }}>{h.status === 'sent' ? `Sent ${when(h.sent_at)}` : h.status}</span></span><span className="sm">{h.clicked_at ? 'Clicked' : h.opened_at ? 'Opened' : ''}</span></div>
            ))}
          </div>
          {ctx.canEdit && (c.unsubscribed_at
            ? (c.unsubscribe_source !== 'deletion_request' && <button type="button" className="btn bs" disabled={busy} onClick={() => { if (window.confirm('Resubscribe this person? Only do this if they asked to hear from Ascentor again.')) toggle(true); }}>Resubscribe</button>)
            : <button type="button" className="btn bd" disabled={busy} onClick={() => toggle(false)}>Unsubscribe from all campaigns</button>)}
        </div>
      </aside>
    </>
  );
}

function AddModal({ ctx, onClose }: { ctx: Ctx; onClose: (changed: boolean) => void }) {
  const [v, setV] = useState({ email: '', name: '', phone: '', tag: '' });
  const [busy, start] = useTransition();
  const save = () => start(async () => { const r = await addContact(v); if (r.ok) { ctx.flash('Contact added.'); onClose(true); } else ctx.flash(r.error, true); });
  return (
    <>
      <div className="scrim modalscrim" onClick={() => onClose(false)} aria-hidden />
      <div className="modal st" role="dialog" aria-modal="true" aria-label="Add a contact">
        <p className="h3" style={{ margin: 0 }}>Add a contact</p>
        <div className="fld"><label htmlFor="ac-e">Email</label><input id="ac-e" className="in" type="email" value={v.email} onChange={(e) => setV({ ...v, email: e.target.value })} autoFocus /></div>
        <div className="fld"><label htmlFor="ac-n">Name</label><input id="ac-n" className="in" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></div>
        <div className="fld"><label htmlFor="ac-p">Phone</label><input id="ac-p" className="in" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} /></div>
        <div className="fld"><label htmlFor="ac-t">Tag <span className="sm">(optional, e.g. “Speakers 2026”)</span></label><input id="ac-t" className="in" value={v.tag} onChange={(e) => setV({ ...v, tag: e.target.value })} /></div>
        <p className="sm">Only add people who agreed to hear from Ascentor.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn bs" onClick={() => onClose(false)}>Cancel</button><button type="button" className="btn bp" disabled={busy || !v.email} onClick={save}>Add</button></div>
      </div>
    </>
  );
}

function ImportModal({ ctx, onClose }: { ctx: Ctx; onClose: (changed: boolean) => void }) {
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [tag, setTag] = useState('');
  const [busy, start] = useTransition();
  const run = () => start(async () => {
    const r = await importContacts(csv, tag);
    if (r.ok) { ctx.flash(`Imported: ${fmt(r.added)} new, ${fmt(r.updated)} already known${r.skipped ? `, ${fmt(r.skipped)} rows without a valid email skipped` : ''}.`); onClose(true); } else ctx.flash(r.error, true);
  });
  return (
    <>
      <div className="scrim modalscrim" onClick={() => onClose(false)} aria-hidden />
      <div className="modal st" role="dialog" aria-modal="true" aria-label="Import contacts">
        <p className="h3" style={{ margin: 0 }}>Import contacts from a CSV</p>
        <p className="sm">The first row must be headings and include a column called <b>email</b>. Columns called <b>name</b> and <b>phone</b> are picked up too. Existing contacts keep their details and get the tag.</p>
        <input type="file" accept=".csv,text/csv" onChange={async (e) => { const file = e.target.files?.[0]; if (!file) return; if (file.size > 5_000_000) { ctx.flash('That file is larger than 5 MB.', true); return; } setFileName(file.name); setCsv(await file.text()); }} />
        {fileName && <p className="sm">{fileName} · {fmt(Math.max(0, csv.split('\n').filter((l) => l.trim()).length - 1))} rows</p>}
        <div className="fld"><label htmlFor="im-t">Tag everyone in this file <span className="sm">(optional)</span></label><input id="im-t" className="in" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. LASU Ojo students" /></div>
        <p className="sm">Only import people who agreed to hear from Ascentor. Unsubscribed addresses stay unsubscribed.</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}><button type="button" className="btn bs" onClick={() => onClose(false)}>Cancel</button><button type="button" className="btn bp" disabled={busy || !csv} onClick={run}>{busy ? 'Importing…' : 'Import'}</button></div>
      </div>
    </>
  );
}
