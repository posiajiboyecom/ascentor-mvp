'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { addCategory, renameCategory, setCategoryActive } from '@/app/admin/categories/actions';
import { useToast } from '@/components/rx/Toast';

export interface CategoryRow { slug: string; name: string; active: boolean; posts: number }

function Row({ c }: { c: CategoryRow }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(c.name);
  const [pending, start] = useTransition();
  return (
    <div className="rx-row rx-nw" style={{ gap: 8, alignItems: 'center' }}>
      <input className="rx-in" style={{ flex: 1, minHeight: 44, opacity: c.active ? 1 : 0.55 }} aria-label={`Name for ${c.name}`} value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
      <span className="rx-sm" style={{ whiteSpace: 'nowrap', minWidth: 70 }}>{c.posts} {c.posts === 1 ? 'post' : 'posts'}</span>
      {name.trim() !== c.name && <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => start(async () => { const r = await renameCategory(c.slug, name); toast(r.ok ? 'Renamed. Existing posts moved with it.' : r.error); router.refresh(); })}>Save</button>}
      <button type="button" className="rx-btn secondary" disabled={pending} onClick={() => start(async () => { const r = await setCategoryActive(c.slug, !c.active); toast(r.ok ? (c.active ? 'Hidden from the post form.' : 'Shown again.') : r.error); router.refresh(); })}>{c.active ? 'Hide' : 'Show'}</button>
    </div>
  );
}

export default function CategoriesAdmin({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState('');
  const [pending, start] = useTransition();
  return (
    <div className="rx-card rx-stack">
      {rows.map((c) => <Row key={c.slug} c={c} />)}
      <div className="rx-row rx-nw" style={{ gap: 8 }}>
        <input className="rx-in" style={{ flex: 1 }} placeholder="New category, for example Health" aria-label="New category name" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <button type="button" className="rx-btn primary" disabled={pending || name.trim().length < 2} onClick={() => start(async () => { const r = await addCategory(name); toast(r.ok ? 'Category added.' : r.error); if (r.ok) setName(''); router.refresh(); })}>Add</button>
      </div>
    </div>
  );
}
