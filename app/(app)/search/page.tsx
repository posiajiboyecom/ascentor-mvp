import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowRight, ChevronRight, Search } from 'lucide-react';
import { getMe } from '@/lib/rx/server';
import { cleanQuery, runSearch } from '@/lib/rx/search';
import { Page, Title } from '@/components/rx/ui';
import EmptyLamp from '@/components/rx/pages/EmptyLamp';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

const SUGGESTIONS = ['Cybersecurity', 'Focus', 'Lagos', 'Finance'];

export default async function SearchPage({ searchParams }: { searchParams: Promise<{ q?: string; tab?: string }> }) {
  const me = await getMe();
  if (!me) redirect('/login');
  const sp = await searchParams;
  const raw = (sp.q ?? '').slice(0, 60);
  const q = cleanQuery(raw);
  const sections = q.length >= 2 ? await runSearch(q) : [];
  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const tab = sections.some((s) => s.key === sp.tab) ? sp.tab : 'all';
  const href = (t: string) => `/search?q=${encodeURIComponent(q)}${t === 'all' ? '' : `&tab=${t}`}`;
  const shown = sections.filter((s) => tab === 'all' || s.key === tab);
  const chips = (
    <div className="rx-row" style={{ gap: 8, flexWrap: 'wrap' }}>
      {SUGGESTIONS.map((w) => <Link key={w} href={`/search?q=${encodeURIComponent(w)}`} className="rx-chip">{w}</Link>)}
    </div>
  );

  return (
    <Page>
      <Title>Search</Title>
      <div className="rx-stack-lg" style={{ maxWidth: 820 }}>
        <form action="/search" method="get" role="search">
          <label className="rx-search lg">
            <Search aria-hidden />
            <input name="q" defaultValue={raw} placeholder="Search lessons, groups, people and posts" aria-label="Search" autoComplete="off" maxLength={60} />
          </label>
        </form>

        {q && total > 0 && (
          <div className="rx-opts rx-tabs" role="group" aria-label="Result types">
            <Link href={href('all')} replace scroll={false} className={`rx-opt${tab === 'all' ? ' on' : ''}`} aria-pressed={tab === 'all'}>{`All · ${total}`}</Link>
            {sections.map((s) => (
              <Link key={s.key} href={href(s.key)} replace scroll={false} className={`rx-opt${tab === s.key ? ' on' : ''}`} aria-pressed={tab === s.key}>{`${s.label} · ${s.items.length}`}</Link>
            ))}
          </div>
        )}

        {shown.map((s) => {
          const items = tab === 'all' ? s.items.slice(0, 3) : s.items;
          return (
            <div key={s.key} className="rx-stack-sm">
              <p className="rx-label">{s.label}</p>
              <div className="rx-card" style={{ padding: '4px 16px' }}>
                {items.map((it, i) => (
                  <Link key={`${it.href}-${i}`} href={it.href} className="rx-rowlink">
                    <span className="ri txt">{it.mark}</span>
                    <span className="rt"><span className="t">{it.title}</span><span className="m">{it.meta}</span></span>
                    <ChevronRight aria-hidden />
                  </Link>
                ))}
              </div>
              {tab === 'all' && s.items.length > 3 && (
                <div><Link href={href(s.key)} className="rx-link" style={{ fontSize: 14 }}>{`See all ${s.items.length} ${s.label.toLowerCase()}`}<ArrowRight aria-hidden /></Link></div>
              )}
            </div>
          );
        })}

        {q.length >= 2 && total === 0 && (
          <div className="rx-card rx-empty">
            <EmptyLamp />
            <p className="rx-h3">No results for “{raw}”</p>
            <p className="rx-sm">Try a broader word, or one of these.</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>{chips}</div>
          </div>
        )}

        {q.length < 2 && (
          <div className="rx-stack-sm">
            <p className="rx-label">Try</p>
            {chips}
          </div>
        )}
      </div>
    </Page>
  );
}
