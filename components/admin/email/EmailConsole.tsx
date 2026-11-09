'use client';

// Admin → Email. Campaigns to any mix of contacts, the contact book (every source, categorised), templates, settings.
// The server checks every permission again; this only draws and collects.
import './email-console.css';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadOverview, duplicateCampaign, deleteCampaign, type Overview, type Draft, type Template } from '@/app/admin/c/newsletter/actions';
import Composer from './Composer';
import CampaignView from './CampaignView';
import ContactsTab from './ContactsTab';
import TemplatesTab from './TemplatesTab';
import SettingsTab from './SettingsTab';

export interface Ctx {
  overview: Overview;
  canEdit: boolean;
  canSend: boolean;
  me: { email: string; name: string };
  triggerReady: boolean;
  flash: (text: string, bad?: boolean) => void;
  refresh: () => Promise<void>;
}

type Tab = 'campaigns' | 'contacts' | 'templates' | 'settings';
type View = { kind: 'list' } | { kind: 'compose'; draft: Draft; template?: boolean; templateId?: string } | { kind: 'campaign'; id: string };

export const STATUS: Record<string, [string, 'good' | 'warn' | 'bad' | '']> = {
  draft: ['Draft', ''], scheduled: ['Scheduled', 'warn'], sending: ['Sending', 'warn'], paused: ['Paused', 'warn'], sent: ['Sent', 'good'], cancelled: ['Cancelled', 'bad'],
};
export const pct = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '–');
export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '–');
export const fmt = (n: number) => n.toLocaleString('en-GB');
export const BLANK: Draft = { name: '', subject: '', preheader: '', heading: '', body_html: '', audience: { all: false, sources: [], tags: [], exclude: [], emails: [] } };

export default function EmailConsole({ initial, loadError, canEdit, canSend, me, triggerReady }: {
  initial: Overview | null; loadError?: string; canEdit: boolean; canSend: boolean; me: { email: string; name: string }; triggerReady: boolean;
}) {
  const [overview, setOverview] = useState<Overview | null>(initial);
  const [tab, setTab] = useState<Tab>('campaigns');
  const [view, setView] = useState<View>({ kind: 'list' });
  const [toast, setToast] = useState<{ text: string; bad: boolean } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flash = useCallback((text: string, bad = false) => {
    setToast({ text, bad });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  const refresh = useCallback(async () => {
    const r = await loadOverview();
    if (r.ok) setOverview(r.overview); else flash(r.error, true);
  }, [flash]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!overview) {
    return (
      <div className="admc"><div className="pg screen">
        <p className="eyebrow">Marketing</p><h1 className="pt">Email</h1><span className="ul" />
        <div className="em-note bad" style={{ marginTop: 16 }}>{loadError ?? 'We couldn’t load email.'} If this is the first time, run the database migration <span className="em-mono">20261109_email_system.sql</span> in Supabase.</div>
      </div></div>
    );
  }

  const ctx: Ctx = { overview, canEdit, canSend, me, triggerReady, flash, refresh };
  const s = overview.settings;
  const queued = overview.campaigns.reduce((n, c) => n + (c.status === 'sending' || c.status === 'paused' ? c.stats.queued : 0), 0);
  const capLeft = Math.max(0, s.daily_limit - overview.sent24);

  const openTemplateAsCampaign = (t: Template) => { setTab('campaigns'); setView({ kind: 'compose', draft: { ...BLANK, name: t.name, subject: t.subject, preheader: t.preheader, body_html: t.body_html, sender: t.sender } }); };

  return (
    <div className="admc">
      <div className="pg screen">
        <div className="sb" style={{ alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div><p className="eyebrow">Marketing</p><h1 className="pt">Email</h1><span className="ul" /></div>
          <div className="em-gauge" aria-label="Sending in the last 24 hours">
            <div className="sb"><span className="sm">Sent in the last 24 hours</span><span className="num">{fmt(overview.sent24)} / {fmt(s.daily_limit)}</span></div>
            <div className="em-progress"><span style={{ width: `${Math.min(100, (overview.sent24 / s.daily_limit) * 100)}%` }} /></div>
            <span className="sm">{queued ? `${fmt(queued)} waiting to send · ${fmt(capLeft)} left today` : `${fmt(capLeft)} more can go out today`}</span>
          </div>
        </div>

        {!triggerReady && queued > 0 && (
          <div className="card" role="status" style={{ marginTop: 18, borderColor: 'var(--warn, #C8A96E)' }}>
            <p className="h3" style={{ margin: 0 }}>{fmt(queued)} {queued === 1 ? 'email is' : 'emails are'} waiting to go out</p>
            <p className="sm" style={{ margin: '4px 0 0' }}>The background sender is not switched on, so they only go out while you have the campaign open here (with “Keep sending from this screen” on), and once a day. Open the campaign and leave it open, or ask your developer to run <span className="em-mono">npm run trigger:deploy</span>.</p>
          </div>
        )}

        <div className="kpis" style={{ marginTop: 18 }}>
          <div className="card kpi"><span className="k">Contacts</span><span className="v">{fmt(overview.contacts)}</span><span className="sm">from {overview.sources.filter((x) => x.total).length} sources</span></div>
          <div className="card kpi"><span className="k">Reachable</span><span className="v">{fmt(overview.reachable)}</span><span className="sm">not unsubscribed or bounced</span></div>
          <div className="card kpi"><span className="k">Campaigns sent</span><span className="v">{fmt(overview.campaigns.filter((c) => c.status === 'sent').length)}</span><span className="sm">{overview.campaigns.filter((c) => c.status === 'sending' || c.status === 'scheduled').length} active or scheduled</span></div>
          <div className="card kpi"><span className="k">Last open rate</span><span className="v">{(() => { const c = overview.campaigns.find((x) => x.status === 'sent' && x.stats.sent); return c ? pct(c.stats.opened, c.stats.sent) : '–'; })()}</span><span className="sm">most recent sent campaign</span></div>
        </div>

        {view.kind === 'list' && (
          <div className="em-tabs" role="tablist">
            {([['campaigns', 'Campaigns', overview.campaigns.length], ['contacts', 'Contacts', overview.contacts], ['templates', 'Templates', null], ['settings', 'Settings', null]] as const).map(([k, label, n]) => (
              <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}{n != null && <span className="n">{fmt(n)}</span>}</button>
            ))}
          </div>
        )}

        {view.kind === 'compose' && (
          <Composer ctx={ctx} initial={view.draft} templateMode={view.template} templateId={view.templateId}
            onClose={async (openId) => { await refresh(); setView(openId ? { kind: 'campaign', id: openId } : { kind: 'list' }); }} />
        )}
        {view.kind === 'campaign' && (
          <CampaignView ctx={ctx} id={view.id} onBack={async () => { await refresh(); setView({ kind: 'list' }); }}
            onEdit={(d) => setView({ kind: 'compose', draft: d })} onOpen={(id) => setView({ kind: 'campaign', id })} />
        )}

        {view.kind === 'list' && tab === 'campaigns' && (
          <div className="st">
            <div className="sb">
              <p className="sm">Write once and send to any mix of contacts. Every email carries an unsubscribe link.</p>
              {canEdit && <button type="button" className="btn bp" onClick={() => setView({ kind: 'compose', draft: BLANK })}>New campaign</button>}
            </div>
            {overview.campaigns.length === 0 ? (
              <div className="card empty"><p className="h3">No campaigns yet</p><p className="sm">Start one for an announcement, an event invite, a product launch or a newsletter issue.</p></div>
            ) : (
              <div className="tblwrap"><table className="tbl">
                <thead><tr><th>Campaign</th><th>Audience</th><th>Status</th><th>Progress</th><th>Opened</th><th>Clicked</th><th>Updated</th><th /></tr></thead>
                <tbody>
                  {overview.campaigns.map((c) => {
                    const [label, tone] = STATUS[c.status] ?? [c.status, ''];
                    const done = c.stats.sent + c.stats.failed + c.stats.skipped;
                    return (
                      <tr key={c.id}>
                        <td><button type="button" className="rowbtn" onClick={() => setView(c.status === 'draft' ? { kind: 'campaign', id: c.id } : { kind: 'campaign', id: c.id })}>{c.name}</button><span className="sm" style={{ display: 'block' }}>{c.subject || 'No subject yet'}</span></td>
                        <td className="sm" style={{ maxWidth: 240 }}>{c.audience}</td>
                        <td><span className={`tag ${tone}`}><i />{label}</span>{c.status === 'scheduled' && <span className="sm" style={{ display: 'block' }}>{when(c.scheduled_at)}</span>}</td>
                        <td>{c.stats.total ? (<><div className="em-progress em-prog-sm"><span style={{ width: `${(done / c.stats.total) * 100}%` }} /></div><span className="sm">{fmt(c.stats.sent)} / {fmt(c.stats.total)}</span></>) : <span className="sm">–</span>}</td>
                        <td className="num">{pct(c.stats.opened, c.stats.sent)}</td>
                        <td className="num">{pct(c.stats.clicked, c.stats.sent)}</td>
                        <td className="sm">{when(c.updated_at)}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          {canEdit && <button type="button" className="lk" onClick={async () => { const r = await duplicateCampaign(c.id); if (r.ok) { await refresh(); setView({ kind: 'campaign', id: r.id }); } else flash(r.error, true); }}>Duplicate</button>}
                          {canEdit && c.status === 'draft' && <button type="button" className="lk" style={{ marginLeft: 12, color: 'var(--err)' }} onClick={async () => { if (!window.confirm(`Delete the draft “${c.name}”?`)) return; const r = await deleteCampaign(c.id); if (r.ok) { flash('Draft deleted.'); await refresh(); } else flash(r.error, true); }}>Delete</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table></div>
            )}
          </div>
        )}
        {view.kind === 'list' && tab === 'contacts' && <ContactsTab ctx={ctx} />}
        {view.kind === 'list' && tab === 'templates' && (
          <TemplatesTab ctx={ctx} onUse={openTemplateAsCampaign}
            onEdit={(t: Template | null) => { setTab('templates'); setView({ kind: 'compose', template: true, templateId: t?.id, draft: { ...BLANK, name: t?.name ?? '', subject: t?.subject ?? '', preheader: t?.preheader ?? '', body_html: t?.body_html ?? '', sender: t?.sender ?? 'default' } }); }} />
        )}
        {view.kind === 'list' && tab === 'settings' && <SettingsTab ctx={ctx} />}
      </div>
      {toast && <div className="toast" role={toast.bad ? 'alert' : 'status'} style={toast.bad ? { borderColor: 'var(--err)' } : undefined}>{toast.text}</div>}
    </div>
  );
}
