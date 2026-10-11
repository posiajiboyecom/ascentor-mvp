// app/(app)/community/page.tsx
// Community: one living feed where members post, react, comment and share. Posts carry a category and can be rich text
// with photos or video. Groups are reached from the menu.

import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { getCategories, getFeed } from '@/lib/rx/feed';
import { Page, Title } from '@/components/rx/ui';
import FeedClient from '@/components/rx/community/FeedClient';

export const dynamic = 'force-dynamic';

export default async function CommunityPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const sp = await searchParams;
  const me = await getMe();
  if (!me) redirect('/login');
  const categories = await getCategories();
  const category = sp.category && categories.some((c) => c.name === sp.category) ? sp.category : null;
  const { posts, next } = await getFeed({ category });

  return (
    <Page>
      <Title>Community</Title>
      <div style={{ maxWidth: 720 }}>
        <FeedClient
          key={category ?? 'all'}
          initialPosts={posts} initialNext={next} categories={categories} category={category}
          me={{ name: me.fullName, avatarUrl: me.avatarUrl, userId: me.userId }} canModerate={me.isStaff}
        />
      </div>
    </Page>
  );
}
