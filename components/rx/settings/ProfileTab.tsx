'use client';

// Settings > Profile: photo, display name, headline, city, about, interests and visibility.
// Saved: photo, display name, headline, city. Not saved yet (no column or table behind them): About, Visibility, interests picker.

import { useRef, useState, useTransition } from 'react';
import { ArrowRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useToast } from '@/components/rx/Toast';
import { Avatar } from '@/components/rx/ui';
import { saveProfile } from '@/app/(app)/settings/actions';

export default function ProfileTab({ userId, name, headline, city, cities, stage, interests, avatarUrl }: {
  userId: string; name: string; headline: string; city: string; cities: string[]; stage: string; interests: string[]; avatarUrl: string | null;
}) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [photo, setPhoto] = useState(avatarUrl);
  const [nm, setNm] = useState(name);
  const [hl, setHl] = useState(headline);
  const [ct, setCt] = useState(city);
  const [about, setAbout] = useState('');
  const [vis, setVis] = useState('All members');
  const [wins, setWins] = useState(true);
  const [showCity, setShowCity] = useState(true);
  const cityOpts = Array.from(new Set([...(city ? [city] : []), ...cities, 'Somewhere else']));

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Please choose an image file (JPG, PNG or WebP).'); return; }
    if (file.size > 2 * 1024 * 1024) { toast('That image is over 2 MB. Please choose a smaller one.'); return; }
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `avatars/${userId}.${ext}`;
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true });
    if (error) { toast('The photo didn’t upload. Please try again.'); return; }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
    const url = `${publicUrl}?t=${Date.now()}`;
    const { error: upErr } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
    if (upErr) { toast('The photo didn’t save. Please try again.'); return; }
    setPhoto(url);
    toast('Photo updated.');
  };

  const removePhoto = async () => {
    if (!photo) { toast('You haven’t added a photo yet.'); return; }
    const { error } = await createClient().from('profiles').update({ avatar_url: null }).eq('id', userId);
    if (error) { toast('We couldn’t remove the photo. Please try again.'); return; }
    setPhoto(null);
    toast('Photo removed.');
  };

  const save = () => start(async () => {
    const r = await saveProfile({ name: nm, headline: hl, city: ct === 'Somewhere else' ? '' : ct });
    toast(r.ok ? 'Profile saved.' : r.error);
  });

  return (
    <>
      <div className="rx-card st">
        <div className="rx-row rx-nw" style={{ gap: 16 }}>
          <Avatar name={nm} url={photo} size="lg" seed={userId} />
          <div className="rx-row">
            <button type="button" className="rx-btn secondary" onClick={() => fileRef.current?.click()}>Change photo</button>
            <button type="button" className="rx-btn lkb muted" onClick={removePhoto}>Remove</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={upload} />
          </div>
        </div>
        <div className="rx-fld"><label htmlFor="pfn">Display name</label><input id="pfn" className="rx-in" value={nm} maxLength={80} onChange={(e) => setNm(e.target.value)} /></div>
        <div className="rx-fld"><label htmlFor="pfh">Headline</label><input id="pfh" className="rx-in" placeholder="What you’re building" value={hl} maxLength={120} onChange={(e) => setHl(e.target.value)} /><span className="rx-sm">Shown under your name in messages and groups.</span></div>
        <div className="rx-grid2">
          <div className="rx-fld"><label htmlFor="pfc">City</label>
            <select id="pfc" className="rx-in" value={cityOpts.includes(ct) ? ct : ''} onChange={(e) => setCt(e.target.value)}>
              {!ct && <option value="">Choose a city</option>}
              {cityOpts.map((c) => <option key={c} value={c}>{c}</option>)}
            </select></div>
          <div className="rx-fld"><span className="rx-fld-label">Stage</span><div className="rx-row" style={{ minHeight: 48, gap: 8 }}><span className="rx-tag">{stage || 'Not set yet'}</span><span className="rx-sm">Set from onboarding</span></div></div>
        </div>
        <div className="rx-fld"><label htmlFor="pfb">About</label><textarea id="pfb" className="rx-in" value={about} onChange={(e) => setAbout(e.target.value)} /></div>
        <div className="rx-fld"><span className="rx-fld-label">Interests</span>
          <div className="rx-row" style={{ gap: 6 }}>
            {interests.map((t) => <span key={t} className="rx-tag">{t}</span>)}
            <button type="button" className="rx-btn lkb" style={{ minHeight: 32 }} onClick={() => toast('Opens the interest picker.')}>Edit<ArrowRight aria-hidden /></button>
          </div></div>
      </div>

      <div className="rx-card st">
        <p className="rx-sl">Visibility</p>
        <div className="rx-fld"><label htmlFor="pfv">Who can see my profile</label>
          <select id="pfv" className="rx-in" value={vis} onChange={(e) => setVis(e.target.value)}><option>All members</option><option>My Circle and groups</option><option>My Circle only</option></select></div>
        <div className="rx-sb"><div><p className="rx-p">Show my wins on my profile</p><p className="rx-sm">Wins you post publicly appear here.</p></div><button type="button" className="rx-toggle" aria-label="Show my wins on my profile" aria-pressed={wins} onClick={() => setWins(!wins)} /></div>
        <div className="rx-sb"><div><p className="rx-p">Show my city</p><p className="rx-sm">Helps members near you find you in city groups.</p></div><button type="button" className="rx-toggle" aria-label="Show my city" aria-pressed={showCity} onClick={() => setShowCity(!showCity)} /></div>
      </div>
      <div><button type="button" className="rx-btn primary" onClick={save} disabled={pending}>Save changes</button></div>
    </>
  );
}
