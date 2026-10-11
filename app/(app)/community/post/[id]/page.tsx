// app/(app)/community/post/[id]/page.tsx
// A single post with its comments open. This is where share links land.

import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { getPost } from '@/lib/rx/feed';
import { BackLink, Page } from '@/components/rx/ui';
import PostCard from '@/components/rx/community/PostCard';

export const dynamic = 'force-dynamic';

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await getMe();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/community/post/${id}`)}`);
  const post = await getPost(id);
  if (!post) notFound();
  return (
    <Page>
      <BackLink href="/community">Community</BackLink>
      <div style={{ maxWidth: 720 }}>
        <PostCard post={post} startOpen canModerate={me.isStaff} />
      </div>
    </Page>
  );
}
