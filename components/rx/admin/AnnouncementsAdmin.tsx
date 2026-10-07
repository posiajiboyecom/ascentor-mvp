'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Megaphone } from 'lucide-react';
import { AUDIENCES, AUDIENCE_HINT } from '@/lib/rx/constants';
import { saveAnnouncement, type AnnouncementInput } from '@/app/admin/announcements/actions';
import { useToast } from '@/components/rx/Toast';

export interface AdminAnn extends AnnouncementInput { id: string }

const blank = (): AnnouncementInput => ({ title: 'New announcement', text: '', date_label: '', time_label: '', location: '', btn_label: 'Learn more', link: '', image_url: null, audience: 'All members', aud_value: '', banner: false, featured: false, starts_on: '', ends_on: '', status: 'Draft' });

export default function AnnouncementsAdmin({ initial }: { initial: AdminAnn[] }) {
  const router = useRouter();
  const toast = useToast();
  const [list, setList] = useState<AnnouncementInput[]>(initial);
  const [sel, setSel] = useState(0);
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const a = list[sel];
  const set = <K extends keyof AnnouncementInput>(k: K, v: AnnouncementInput[K]) => setList((cur) => cur.map((x, i) => (i === sel ? { ...x, [k]: v } : x)));
  const line = [a?.date_label ? a.date_label + (a.time_label ? `, ${a.time_label}` : '') : '', a?.location].filter(Boolean).join(' · ') || a?.text || '';

  async function uploadImage(f: File) {
    setUploading(true); setError('');
    try {
      const fd = new FormData(); fd.append('file', f); fd.append('kind', 'img');
      const res = await fetch('/api/rx/upload', { method: 'POST', body: fd });
      const j = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!res.ok || !j.url) throw new Error(j.error || 'Upload failed.');
      set('image_url', j.url);
    } catch (e) { setError(e instanceof Error ? e.message : 'Upload failed.'); } finally { setUploading(false); }
  }

  if (!a) return null;
  return (
    <div className="rx-annadmin">
      <div className="rx-stack-sm">
        <p className="rx-label">All announcements</p>
        {list.map((x, i) => (
          <button key={x.id ?? `new${i}`} type="button" className="rx-anitem" aria-pressed={i === sel} onClick={() => setSel(i)}>
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}><span className="rx-strong" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.title}</span><span className="rx-sm">{x.status}{x.featured ? ' · Featured' : ''}{x.id ? '' : ' · unsaved'}</span></span>
          </button>
        ))}
        <div><button type="button" className="rx-btn secondary" onClick={() => { setList((c) => [...c, blank()]); setSel(list.length); }}>New announcement</button></div>
      </div>

      <div className="rx-card rx-stack">
        <div className="rx-fld"><label htmlFor="at">Title</label><input id="at" className="rx-in" value={a.title} maxLength={120} onChange={(e) => set('title', e.target.value)} /></div>
        <div className="rx-fld"><label htmlFor="ax">Short text</label><textarea id="ax" className="rx-in" style={{ minHeight: 72 }} value={a.text} maxLength={500} onChange={(e) => set('text', e.target.value)} /></div>
        <div className="rx-grid2"><div className="rx-fld"><label htmlFor="ad">Date</label><input id="ad" className="rx-in" value={a.date_label} placeholder="Thu 19 Nov 2026" onChange={(e) => set('date_label', e.target.value)} /></div>
          <div className="rx-fld"><label htmlFor="ati">Time</label><input id="ati" className="rx-in" value={a.time_label} placeholder="Optional" onChange={(e) => set('time_label', e.target.value)} /></div></div>
        <div className="rx-fld"><label htmlFor="al">Location</label><input id="al" className="rx-in" value={a.location} onChange={(e) => set('location', e.target.value)} /></div>
        <div className="rx-fld"><span className="rx-fld-label">Image (optional)</span>
          <div className="rx-row">
            <label className="rx-btn secondary" style={{ cursor: 'pointer' }}>{uploading ? 'Uploading…' : a.image_url ? 'Replace image' : 'Add image'}<input type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadImage(f); e.target.value = ''; }} /></label>
            {a.image_url && <button type="button" className="rx-link muted" onClick={() => set('image_url', null)}>Remove image</button>}
          </div>
        </div>
        <div className="rx-grid2"><div className="rx-fld"><label htmlFor="ab">Button label</label><input id="ab" className="rx-in" value={a.btn_label} onChange={(e) => set('btn_label', e.target.value)} /></div>
          <div className="rx-fld"><label htmlFor="ak">Link</label><input id="ak" className="rx-in" value={a.link} placeholder="https://… or /page" onChange={(e) => set('link', e.target.value)} /></div></div>
        <div className="rx-fld"><span className="rx-fld-label">Audience</span>
          <div className="rx-opts">{AUDIENCES.map((o) => <button key={o} type="button" className="rx-opt" aria-pressed={a.audience === o} onClick={() => set('audience', o)}>{o}</button>)}</div>
          {a.audience !== 'All members' && <input className="rx-in" aria-label="Audience value" value={a.aud_value} placeholder={AUDIENCE_HINT[a.audience] ?? ''} onChange={(e) => set('aud_value', e.target.value)} />}</div>
        <div className="rx-between"><div><p className="rx-p">Show as banner on Today</p><p className="rx-sm">For important announcements only. It always appears in the Announcements list.</p></div>
          <button type="button" className="rx-toggle" aria-label="Show as banner on Today" aria-pressed={a.banner} onClick={() => set('banner', !a.banner)} /></div>
        <div className="rx-grid2"><div className="rx-fld"><label htmlFor="as">Start date</label><input id="as" type="date" className="rx-in" value={a.starts_on} onChange={(e) => set('starts_on', e.target.value)} /></div>
          <div className="rx-fld"><label htmlFor="ae">End date</label><input id="ae" type="date" className="rx-in" value={a.ends_on} onChange={(e) => set('ends_on', e.target.value)} /></div></div>
        <div className="rx-fld"><span className="rx-fld-label">Status</span><div className="rx-opts">{(['Draft', 'Scheduled', 'Live', 'Ended'] as const).map((o) => <button key={o} type="button" className="rx-opt" aria-pressed={a.status === o} onClick={() => set('status', o)}>{o}</button>)}</div></div>
        <div className="rx-between"><div><p className="rx-p">Featured</p><p className="rx-sm">One featured announcement at a time.</p></div>
          <button type="button" className="rx-toggle" aria-label="Featured" aria-pressed={a.featured} onClick={() => set('featured', !a.featured)} /></div>
        {error && <p className="rx-sm" role="alert" style={{ color: 'var(--rx-danger)' }}>{error}</p>}
        <div><button type="button" className="rx-btn primary" disabled={pending} onClick={() => start(async () => {
          setError('');
          const r = await saveAnnouncement(a);
          if (!r.ok) { setError(r.error); return; }
          set('id', r.id);
          toast(`Saved.${a.status === 'Live' ? ' Members can see it now.' : ''}`); router.refresh();
        })}>{pending ? 'Saving…' : 'Save'}</button></div>
      </div>

      <aside className="rx-aside" style={{ paddingLeft: 0, borderLeft: 0 }}>
        <p className="rx-label">Preview · Today banner</p>
        <div className="rx-annbar">
          <span className="rx-dimdot"><Megaphone aria-hidden /></span>
          <div style={{ flex: 1, minWidth: 0 }}><p className="rx-p rx-strong">{a.title}</p><p className="rx-sm">{line}</p><span className="rx-link" style={{ minHeight: 32 }}>{a.btn_label || 'Open'}<ArrowRight aria-hidden /></span></div>
        </div>
        <p className="rx-sm">{a.banner ? 'Shows as a banner on Today for the chosen audience while live, and in the list.' : 'Shows in the Announcements list only.'}</p>
        <p className="rx-label">Preview · list</p>
        <div className="rx-card flat" style={{ padding: '8px 14px' }}><p className="rx-strong">{a.title}</p><p className="rx-sm">{a.date_label}</p></div>
      </aside>
    </div>
  );
}
