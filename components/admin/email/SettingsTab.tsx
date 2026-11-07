'use client';

// Sender name, reply-to, footer, and the sending pace and daily cap that keep the Hostinger mailbox inside its limits.
import { useState, useTransition } from 'react';
import { saveEmailSettings } from '@/app/admin/c/newsletter/actions';
import type { Settings } from '@/lib/email/system';
import { fmt, type Ctx } from './EmailConsole';

export default function SettingsTab({ ctx }: { ctx: Ctx }) {
  const { overview, canSend, triggerReady, flash, refresh } = ctx;
  const [v, setV] = useState<Settings>(overview.settings);
  const [busy, start] = useTransition();
  const ro = !canSend;
  const save = () => start(async () => { const r = await saveEmailSettings(v); if (r.ok) { flash('Settings saved.'); await refresh(); } else flash(r.error, true); });
  const perHour = Math.min(v.per_minute * 60, v.daily_limit);

  return (
    <div className="g2">
      <div className="card st">
        <p className="h3" style={{ margin: 0 }}>Sender</p>
        <div className="fld"><label htmlFor="es-from">From name</label><input id="es-from" className="in" value={v.from_name} disabled={ro} maxLength={60} onChange={(e) => setV({ ...v, from_name: e.target.value })} /><span className="sm">Sent from the Ascentor mailbox. Recipients see this name.</span></div>
        <div className="fld"><label htmlFor="es-reply">Reply-to <span className="sm">(optional)</span></label><input id="es-reply" className="in" type="email" value={v.reply_to ?? ''} disabled={ro} onChange={(e) => setV({ ...v, reply_to: e.target.value })} placeholder="Defaults to the Ascentor mailbox" /></div>
        <div className="fld"><label htmlFor="es-foot">Footer line</label><input id="es-foot" className="in" value={v.footer_text} disabled={ro} maxLength={200} onChange={(e) => setV({ ...v, footer_text: e.target.value })} /><span className="sm">Shown beside the unsubscribe link. A postal address helps inbox placement.</span></div>
      </div>
      <div className="card st">
        <p className="h3" style={{ margin: 0 }}>Sending limits</p>
        <div className="fld"><label htmlFor="es-day">Most emails in any 24 hours</label><input id="es-day" className="in" inputMode="numeric" value={v.daily_limit} disabled={ro} onChange={(e) => setV({ ...v, daily_limit: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
          <span className="sm">Hostinger allows about 1,000 a day on Business Starter and 3,000 on Business Premium, for each mailbox and including ticket and password emails. Keep this below your plan so those always get through.</span></div>
        <div className="fld"><label htmlFor="es-min">Pace (emails a minute)</label><input id="es-min" className="in" inputMode="numeric" value={v.per_minute} disabled={ro} onChange={(e) => setV({ ...v, per_minute: Number(e.target.value.replace(/\D/g, '')) || 0 })} />
          <span className="sm">A steady pace looks less like spam. At this pace up to {fmt(perHour)} go out an hour.</span></div>
        <div className="setrow">
          <span>Background sender<span className="sm" style={{ display: 'block' }}>{triggerReady ? 'Trigger.dev is connected. After deploying the latest tasks (npm run trigger:deploy), campaigns send every 5 minutes, day and night.' : 'Trigger.dev isn’t connected. Until it is, campaigns send once a day and while a campaign screen is open.'}</span></span>
          <span className={`tag ${triggerReady ? 'good' : 'warn'}`}><i />{triggerReady ? 'Connected' : 'Setup needed'}</span>
        </div>
        {canSend ? <button type="button" className="btn bp" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</button> : <p className="sm">View only. Teammates with full email access change these.</p>}
      </div>
    </div>
  );
}
