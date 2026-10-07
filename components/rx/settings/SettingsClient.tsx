'use client';

import { useState, useTransition } from 'react';
import { DM_POLICIES, LANGUAGES, NOTIF_TYPES } from '@/lib/rx/constants';
import { saveMessaging, saveNotifications, saveResearch, saveLanguage, saveTimezone, unblockMember } from '@/app/(app)/settings/actions';
import { searchZones } from '@/lib/rx/timezones';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/rx/Toast';

export function NotificationsCard({ notif, annMuted, quiet }: { notif: Record<string, boolean>; annMuted: boolean; quiet: boolean }) {
  const toast = useToast();
  const [n, setN] = useState<Record<string, boolean>>(() => Object.fromEntries(NOTIF_TYPES.map((k) => [k, notif[k] ?? false])));
  const [mute, setMute] = useState(annMuted);
  const [q, setQ] = useState(quiet);
  const [, start] = useTransition();
  const persist = (next: Record<string, boolean>, m: boolean, quietNext: boolean, msg?: string) => start(async () => {
    const r = await saveNotifications(next, m, quietNext);
    toast(r.ok ? msg ?? 'Saved.' : r.error);
  });
  return (
    <div className="rx-card rx-stack">
      <p className="rx-label">Notifications</p>
      {NOTIF_TYPES.map((k) => (
        <div key={k} className="rx-between"><span>{k}</span><button type="button" className="rx-toggle" aria-label={k} aria-pressed={n[k]} onClick={() => { const next = { ...n, [k]: !n[k] }; setN(next); persist(next, mute, q); }} /></div>
      ))}
      <div className="rx-between"><div><p className="rx-p">Mute announcements</p><p className="rx-sm">No notifications. They still appear in the app.</p></div>
        <button type="button" className="rx-toggle" aria-label="Mute announcement notifications" aria-pressed={mute} onClick={() => { setMute(!mute); persist(n, !mute, q, !mute ? 'Announcement notifications muted.' : 'Announcement notifications on.'); }} /></div>
      <div className="rx-between"><div><p className="rx-p">Quiet hours</p><p className="rx-sm">10:00 PM to 7:00 AM, in your time zone</p></div>
        <button type="button" className="rx-toggle" aria-label="Quiet hours" aria-pressed={q} onClick={() => { setQ(!q); persist(n, mute, !q); }} /></div>
    </div>
  );
}

export function MessagingCard({ policy, blocked }: { policy: string; blocked: { id: string; name: string }[] }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(policy);
  const [, start] = useTransition();
  return (
    <div className="rx-card rx-stack">
      <p className="rx-label">Messaging</p>
      <div className="rx-fld"><label htmlFor="who">Who can message me</label>
        <select id="who" className="rx-in" value={v} onChange={(e) => { setV(e.target.value); start(async () => { const r = await saveMessaging(e.target.value); toast(r.ok ? 'Saved.' : r.error); }); }}>
          {DM_POLICIES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select></div>
      <div className="rx-stack-sm">
        <div className="rx-between"><span>Blocked members</span><span className="rx-sm">{blocked.length}</span></div>
        {blocked.map((b) => (
          <div key={b.id} className="rx-between"><span className="rx-sm">{b.name}</span>
            <button type="button" className="rx-link" style={{ minHeight: 36, fontSize: 14 }} onClick={() => start(async () => { const r = await unblockMember(b.id); toast(r.ok ? 'Unblocked.' : r.error); router.refresh(); })}>Unblock</button></div>
        ))}
      </div>
    </div>
  );
}

export function ResearchToggle({ on }: { on: boolean }) {
  const toast = useToast();
  const [v, setV] = useState(on);
  const [, start] = useTransition();
  return (
    <div className="rx-between"><div><p className="rx-p">Research consent</p><p className="rx-sm">Share anonymised survey results.</p></div>
      <button type="button" className="rx-toggle" aria-label="Research consent" aria-pressed={v} onClick={() => { setV(!v); start(async () => { const r = await saveResearch(!v); toast(r.ok ? 'Saved.' : r.error); }); }} /></div>
  );
}

export function LanguageSelect({ value }: { value: string }) {
  const toast = useToast();
  const [v, setV] = useState(value);
  const [, start] = useTransition();
  return (
    <select className="rx-in" aria-label="Language" value={v} onChange={(e) => { setV(e.target.value); start(async () => { const r = await saveLanguage(e.target.value); toast(r.ok ? 'Language saved.' : r.error); }); }}>
      {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
    </select>
  );
}

export function TimezoneSelect({ label }: { label: string }) {
  const toast = useToast();
  const [q, setQ] = useState('');
  const [current, setCurrent] = useState(label);
  const [open, setOpen] = useState(false);
  const [, start] = useTransition();
  const res = open ? searchZones(q).list.slice(0, 30) : [];
  return (
    <div className="rx-stack-sm">
      <p className="rx-sm">{current || 'Not set'}</p>
      {!open ? <div><button type="button" className="rx-btn secondary" onClick={() => setOpen(true)}>Change time zone</button></div> : (
        <>
          <input className="rx-in" aria-label="Search time zones" placeholder="Search by city or country" value={q} onChange={(e) => setQ(e.target.value)} />
          <div className="rx-stack-sm" style={{ maxHeight: 240, overflowY: 'auto' }}>
            {res.map((z) => (
              <button key={z.id} type="button" className="rx-tzrow" onClick={() => start(async () => { const r = await saveTimezone(z.id); if (r.ok) { setCurrent(`${z.city}, ${z.country} (${z.off})`); setOpen(false); setQ(''); } toast(r.ok ? `Time zone set to ${z.city}.` : r.error); })}>
                <span className="rx-tzc"><span>{z.city} ({z.off})</span><span className="rx-sm">{z.country}</span></span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
