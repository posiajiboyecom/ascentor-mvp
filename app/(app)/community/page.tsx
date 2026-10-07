// app/(app)/community/page.tsx
// Community: the feed (with this week's prompt) and the Wins board. Every post carries one dimension tag.
// The earlier channel-based Circle lives at /community/channels.

import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Check } from 'lucide-react';
import { getMe } from '@/lib/rx/server';
import { getFeed, getPrompt } from '@/lib/rx/community';
import { getMemberAnnouncements } from '@/lib/rx/announcements';
import { getShellCounts } from '@/lib/rx/shell-counts';
import { DIMENSIONS } from '@/lib/rx/constants';
import { Aside, GoLink, Page, SageLine, Title } from '@/components/rx/ui';
import CommunityTabs from '@/components/rx/community/CommunityTabs';
import { Compose, PostCard, PromptCard } from '@/components/rx/community/CommunityClient';

export const dynamic = 'force-dynamic';

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ tab?: string; dim?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const wins = sp.tab === 'wins';
  const dim = sp.dim && (DIMENSIONS as string[]).includes(sp.dim) ? sp.dim : 'All';

  const [posts, prompt, anns, counts] = await Promise.all([getFeed({ dimension: dim, winsOnly: wins }), wins ? null : getPrompt(), getMemberAnnouncements(), getShellCounts()]);
  const featured = anns.find((a) => a.effective === 'Live' && a.featured) ?? null;
  const base = wins ? '/community?tab=wins' : '/community';
  const chipHref = (d: string) => (d === 'All' ? base : `${base}${base.includes('?') ? '&' : '?'}dim=${encodeURIComponent(d)}`);

  return (
    <Page>
      <Title>Community</Title>
      <CommunityTabs active={wins ? 'wins' : 'feed'} />
      <div className="rx-two">
        <div className="rx-stack">
          {!wins && prompt && <PromptCard id={prompt.id} body={prompt.body} replies={prompt.replies} count={prompt.count} />}
          {!wins && <Compose />}
          {wins && <SageLine>Commitments kept and projects started.</SageLine>}

          <div className="rx-row" style={{ gap: 8 }} role="group" aria-label="Filter by dimension">
            {['All', ...DIMENSIONS].map((d) => (
              <Link key={d} href={chipHref(d)} className="rx-chip" aria-pressed={dim === d}>{dim === d && <Check aria-hidden />}{d}</Link>
            ))}
          </div>

          {posts.map((p) => <PostCard key={p.id} post={p} />)}
          {posts.length === 0 && (
            <div className="rx-card rx-empty"><p className="rx-p">No posts here yet.</p><Link href={base} className="rx-btn secondary">Show all</Link></div>
          )}
        </div>

        <Aside>
          <p className="rx-label">This week, live</p>
          <div className="rx-between"><span>Monday prompt</span><span className="rx-sm">Mon 8:00 AM</span></div>
          <Link href="/community/groups/open-house" className="rx-between" style={{ color: 'inherit', textDecoration: 'none' }}><span>Live conversation</span><span className="rx-sm">Wed 7:00 PM</span></Link>
          <Link href="/community?tab=wins" className="rx-between" style={{ color: 'inherit', textDecoration: 'none' }}><span>Friday wins</span><span className="rx-sm">Fri 5:00 PM</span></Link>
          {counts.cityGroupSlug && (<><p className="rx-label">City groups</p><GoLink href={`/community/groups/${counts.cityGroupSlug}`}>{counts.cityName}</GoLink></>)}
          {featured && (
            <div className="rx-soft rx-stack-sm"><p className="rx-label">Announcement</p><p className="rx-p rx-strong">{featured.title}</p><p className="rx-sm">{featured.line}</p>
              <GoLink href={`/announcements?focus=${featured.id}`}>{featured.btn_label || 'Learn more'}</GoLink></div>
          )}
          <GoLink href="/community/groups">Looking for a smaller room? Groups</GoLink>
          <p className="rx-sm">Win posts also appear on the Wins board. <Link href="/community/channels" className="rx-link" style={{ minHeight: 0, fontSize: 14 }}>Open the channels</Link></p>
        </Aside>
      </div>
    </Page>
  );
}
