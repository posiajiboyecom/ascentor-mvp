'use client';
// Pieces shared by CirclesConsole and CircleDetail.
import type { CircleInput } from '@/app/admin/c/circles/actions';
import { Tag } from './ui';

export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const LANGS = ['English', 'Nigerian Pidgin', 'Yoruba', 'Igbo', 'Hausa'];
export const STAGES = ['Seeking', 'Building', 'Leading'];
export const SLOTS = ['Weekday mornings', 'Weekday evenings', 'Saturdays', 'Sundays'];
export const MAX = 8;
export const meetingLabel = (dow: number, time: string) => {
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  return `${DAYS[dow]?.slice(0, 3) ?? '–'} ${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
export const statusTag = (s: string) => (s === 'active' ? <Tag tone="good">Active</Tag> : s === 'forming' ? <Tag tone="warn">Forming</Tag> : <Tag tone="">Closed</Tag>);

export function CircleFields({ v, set, disabled }: { v: CircleInput; set: (p: Partial<CircleInput>) => void; disabled?: boolean }) {
  return (
    <div className="cm-grid">
      <div className="fld"><label htmlFor="c-lang">Language</label><select id="c-lang" className="in" value={v.language ?? 'English'} disabled={disabled} onChange={(e) => set({ language: e.target.value })}>{LANGS.map((l) => <option key={l}>{l}</option>)}</select></div>
      <div className="fld"><label htmlFor="c-stage">Stage</label><select id="c-stage" className="in" value={v.stage ?? ''} disabled={disabled} onChange={(e) => set({ stage: e.target.value || null })}><option value="">Any stage</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="fld"><label htmlFor="c-slot">Time slot</label><select id="c-slot" className="in" value={v.slot ?? ''} disabled={disabled} onChange={(e) => set({ slot: e.target.value || null })}><option value="">Any</option>{SLOTS.map((s) => <option key={s}>{s}</option>)}</select></div>
      <div className="fld"><label htmlFor="c-tz">Time zone</label><input id="c-tz" className="in" value={v.timezone ?? ''} placeholder="Africa/Lagos" disabled={disabled} onChange={(e) => set({ timezone: e.target.value })} /></div>
      <div className="fld"><label htmlFor="c-dow">Meeting day</label><select id="c-dow" className="in" value={v.meeting_dow ?? 4} disabled={disabled} onChange={(e) => set({ meeting_dow: Number(e.target.value) })}>{DAYS.map((d, i) => <option key={d} value={i}>{d}</option>)}</select></div>
      <div className="fld"><label htmlFor="c-time">Meeting time</label><input id="c-time" type="time" className="in" value={(v.meeting_time ?? '19:00').slice(0, 5)} disabled={disabled} onChange={(e) => set({ meeting_time: e.target.value })} /></div>
      <div className="fld"><label htmlFor="c-int">Interest (interest Circles only)</label><input id="c-int" className="in" value={v.interest ?? ''} placeholder="Leave empty for a home Circle" disabled={disabled} onChange={(e) => set({ interest: e.target.value })} /></div>
      <div className="fld"><label htmlFor="c-url">Meeting link (optional)</label><input id="c-url" className="in" value={v.meeting_url ?? ''} placeholder="https://… (leave empty for in-app calls)" disabled={disabled} onChange={(e) => set({ meeting_url: e.target.value })} /></div>
      <div className="fld full"><label htmlFor="c-focus">Focus (optional)</label><input id="c-focus" className="in" value={v.focus ?? ''} maxLength={300} placeholder="What this Circle is working towards" disabled={disabled} onChange={(e) => set({ focus: e.target.value })} /></div>
    </div>
  );
}

