'use client';

// One campaign: progress while it sends, results after (delivered, opened, clicked, unsubscribed, failed), and controls.
// Drafts open straight in the composer. While a campaign is sending and this screen is open, it keeps sending from here
// too (useful when the background dispatcher isn't deployed yet).
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { duplicateCampaign, getCampaign, previewCampaign, resendToUnopened, sendNextBatch, setCampaignState, type CampaignDetail, type Draft } from '@/app/admin/c/newsletter/actions';
import { describeAudience } from '@/lib/email/describe';
import { STATUS, fmt, pct, when, type Ctx } from './EmailConsole';

export default function CampaignView({ ctx, id, onBack, onEdit, onOpen }: { ctx: Ctx; id: string; onBack: () => void; onEdit: (d: Draft) => void; onOpen: (id: string) => void }) {
  const { canEdit, canSend, flash, triggerReady } = ctx;
  const [d, setD] = useState<CampaignDetail | null>(null);
  const [html, setHtml] = useState('');
  const [busy, start] = useTransition();
  const [pump, setPump] = useState(!triggerReady);
  const [pumpMsg, setPumpMsg] = useState('');
  const pumping = useRef(false);

  const load = useCallback(async () => {
    const r = await getCampaign(id);
    if (!r.ok) { flash(r.error, true); return; }
    const c = r.detail.campaign;
    if (c.status === 'draft' && canEdit) { onEdit({ id: c.id, name: c.name, subject: c.subject, preheader: c.preheader, heading: c.heading, body_html: c.body_html, audience: c.audience, sender: c.sender }); return; }
    setD(r.detail);
    if (!html) { const p = await previewCampaign({ ...c }); if (p.ok) setHtml(p.html); }
  }, [id, canEdit, onEdit, flash, html]);

  useEffect(() => { void load(); }, [load]);

  const status = d?.campaign.status;
  // Refresh numbers while sending.
  useEffect(() => {
    if (status !== 'sending' && status !== 'scheduled') return;
    const t = setInterval(() => { void load(); }, 15_000);
    return () => clearInterval(t);
  }, [status, load]);

  // Optional: keep sending from this screen while it's open.
  useEffect(() => {
    if (!pump || !canSend || status !== 'sending') return;
    let stop = false;
    const tick = async () => {
      if (pumping.current || stop) return;
      pumping.current = true;
      const r = await sendNextBatch();
      pumping.current = false;
      if (r.ok) {
        const x = r.result;
        setPumpMsg(x.ran ? `Last batch: ${x.sent} sent${x.failed ? `, ${x.failed} failed` : ''}${x.skipped ? `, ${x.skipped} skipped` : ''}.${x.reason ? ` ${x.reason}` : ''}` : (x.reason ?? ''));
      } else setPumpMsg(r.error);
      void load();
    };
    void tick();
    const t = setInterval(tick, 45_000);
    return () => { stop = true; clearInterval(t); };
  }, [pump, canSend, status, load]);

  if (!d) return <div className="card empty"><p className="sm">Opening the campaign…</p></div>;
  const c = d.campaign; const s = d.stats;
  const [label, tone] = STATUS[c.status] ?? [c.status, ''];
  const done = s.sent + s.failed + s.skipped;
  const daysLeft = s.queued ? Math.ceil(Math.max(0, s.queued - d.capLeft) / Math.max(1, d.perDay)) : 0;

  const act = (a: 'pause' | 'resume' | 'cancel' | 'unschedule' | 'retry', confirmText?: string) => start(async () => {
    if (confirmText && !window.confirm(confirmText)) return;
    const r = await setCampaignState(c.id, a);
    if (!r.ok) flash(r.error, true); else { flash({ pause: 'Paused.', resume: 'Sending again.', cancel: 'Cancelled. Nothing more will be sent.', unschedule: 'Unscheduled. It’s a draft again.', retry: 'Failed messages queued again.' }[a]); await load(); }
  });

  return (
    <div className="st">
      <div className="sb" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="lk" onClick={onBack}>← Campaigns</button>
        <div className="row">
          {canEdit && c.status === 'scheduled' && <button type="button" className="btn bs" onClick={() => onEdit({ id: c.id, name: c.name, subject: c.subject, preheader: c.preheader, heading: c.heading, body_html: c.body_html, audience: c.audience, sender: c.sender })}>Edit</button>}
          {canEdit && <button type="button" className="btn bs" disabled={busy} onClick={() => start(async () => { const r = await duplicateCampaign(c.id); if (r.ok) onOpen(r.id); else flash(r.error, true); })}>Duplicate</button>}
          {canEdit && c.status === 'sent' && s.sent - s.opened > 0 && (
            <button type="button" className="btn bs" disabled={busy} title="Makes a draft for the people who have not opened it. Some mail apps hide opens, so a few of them will have read it." onClick={() => start(async () => {
              const r = await resendToUnopened(c.id);
              if (r.ok) { flash(`Draft ready for ${fmt(r.count)} ${r.count === 1 ? 'person' : 'people'} who have not opened it. Check it, then send.`); onOpen(r.id); } else flash(r.error, true);
            })}>Resend to unopened</button>
          )}
          {canSend && c.status === 'sending' && <button type="button" className="btn bs" disabled={busy} onClick={() => act('pause')}>Pause</button>}
          {canSend && c.status === 'paused' && <button type="button" className="btn bp" disabled={busy} onClick={() => act('resume')}>Resume</button>}
          {canSend && c.status === 'scheduled' && <button type="button" className="btn bs" disabled={busy} onClick={() => act('unschedule')}>Unschedule</button>}
          {canSend && s.failed > 0 && ['sent', 'sending', 'paused'].includes(c.status) && <button type="button" className="btn bs" disabled={busy} onClick={() => act('retry', `Try the ${s.failed} failed messages again?`)}>Retry failed</button>}
          {canSend && ['sending', 'paused', 'scheduled'].includes(c.status) && <button type="button" className="btn bd" disabled={busy} onClick={() => act('cancel', 'Cancel this campaign? Messages not yet sent will never go out.')}>Cancel</button>}
        </div>
      </div>

      <div className="card st">
        <div className="sb" style={{ flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div><p className="h2" style={{ margin: 0 }}>{c.name}</p><p className="sm" style={{ margin: '4px 0 0' }}>{c.subject}</p></div>
          <span className={`tag ${tone}`}><i />{label}{c.status === 'scheduled' ? ` · ${when(c.scheduled_at)}` : ''}</span>
        </div>
        <p className="sm" style={{ margin: 0 }}>To: {describeAudience(c.audience)} · Started {when(c.started_at)}{c.finished_at ? ` · Finished ${when(c.finished_at)}` : ''}</p>
        {s.total > 0 && (<>
          <div className="em-progress" aria-label={`${done} of ${s.total} processed`}><span style={{ width: `${(done / s.total) * 100}%` }} /></div>
          <div className="em-stats">
            <div className="em-stat"><small>Recipients</small><b>{fmt(s.total)}</b></div>
            <div className="em-stat"><small>Delivered</small><b>{fmt(s.sent)}</b></div>
            <div className="em-stat"><small>Waiting</small><b>{fmt(s.queued)}</b></div>
            <div className="em-stat"><small>Opened</small><b>{pct(s.opened, s.sent)}</b><span className="sm">{fmt(s.opened)}</span></div>
            <div className="em-stat"><small>Clicked</small><b>{pct(s.clicked, s.sent)}</b><span className="sm">{fmt(s.clicked)}</span></div>
            <div className="em-stat"><small>Unsubscribed</small><b>{fmt(s.unsubscribed)}</b></div>
            <div className="em-stat"><small>Failed</small><b style={s.failed ? { color: 'var(--err)' } : undefined}>{fmt(s.failed)}</b></div>
            <div className="em-stat"><small>Skipped</small><b>{fmt(s.skipped)}</b><span className="sm">unsubscribed since</span></div>
          </div>
        </>)}
        {c.status === 'sending' && (
          <div className="em-note">
            {d.capLeft > 0 ? `Sending now at about ${ctx.overview.settings.per_minute} a minute.` : 'Today’s limit is used up; sending picks up again as the 24-hour window frees up.'}
            {daysLeft > 0 ? ` About ${daysLeft} more ${daysLeft === 1 ? 'day' : 'days'} at your daily limit.` : ''}
            {!triggerReady && ' The background sender isn’t deployed yet, so sending happens once a day and while this screen is open.'}
          </div>
        )}
        {canSend && c.status === 'sending' && (
          <div className="setrow">
            <span>Keep sending from this screen while it’s open<span className="sm" style={{ display: 'block' }}>{pumpMsg || 'Sends a batch about every 45 seconds, within your limits.'}</span></span>
            <button type="button" className={`toggle${pump ? ' on' : ''}`} aria-pressed={pump} aria-label="Keep sending from this screen" onClick={() => setPump((p) => !p)} />
          </div>
        )}
        <p className="sm" style={{ margin: 0 }}>Opens are counted when images load, so the real number is usually higher; Apple Mail can also show opens nobody made.</p>
      </div>

      {d.failures.length > 0 && (
        <div className="card st">
          <p className="h3">Failed messages</p>
          <div className="tblwrap"><table className="tbl"><thead><tr><th>Address</th><th>Reason</th></tr></thead>
            <tbody>{d.failures.map((f) => <tr key={f.email}><td className="em-mono">{f.email}</td><td className="sm">{f.error ?? '–'}</td></tr>)}</tbody></table></div>
        </div>
      )}

      <div className="card st">
        <p className="h3">The email</p>
        <iframe className="em-frame" title="Campaign email" sandbox="" srcDoc={html || '<p style="font-family:Arial;padding:20px;color:#6B7280">Loading…</p>'} />
      </div>
    </div>
  );
}
