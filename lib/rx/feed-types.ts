// lib/rx/feed-types.ts
// Shapes and constants for the Community feed. No server code here, so client components can import it.

export const REACTION_KINDS = ['like', 'support', 'insight'] as const;
export type ReactionKind = (typeof REACTION_KINDS)[number];
export const REACTION_LABEL: Record<ReactionKind, string> = { like: 'Like', support: 'Support', insight: 'Insightful' };

export interface MediaItem { url: string; kind: 'image' | 'video' }

export interface CommentView {
  id: string; userId: string | null; name: string; avatarUrl: string | null; body: string; time: string; mine: boolean;
  parentId: string | null; replies: CommentView[];
}

export interface PostView {
  id: string; userId: string | null; name: string; avatarUrl: string | null; isTeam: boolean; category: string | null;
  /** Cleaned on the server before it was stored, so it is safe to render. */
  html: string; text: string; media: MediaItem[]; time: string; createdAt: string; mine: boolean; pinned: boolean;
  reactions: Record<ReactionKind, number> & { mine: ReactionKind | null };
  comments: CommentView[]; commentCount: number; shares: number;
}

export interface CategoryView { slug: string; name: string }

/** Used if the categories table cannot be read, so posting never breaks. */
export const FALLBACK_CATEGORIES: CategoryView[] = [
  { slug: 'questions', name: 'Questions' }, { slug: 'wins', name: 'Wins' }, { slug: 'reflections', name: 'Reflections' }, { slug: 'resources', name: 'Resources' },
];

export const FEED_PAGE = 15;
export const POST_MEDIA_MAX = 4;
export const COMMENT_MAX = 1000;

/** Builds the comment tree: one level of replies. A reply to a reply sits under the same top-level comment. */
export function nestComments(flat: CommentView[]): CommentView[] {
  const byId = new Map(flat.map((c) => [c.id, c]));
  const top: CommentView[] = [];
  for (const c of flat) {
    const parent = c.parentId ? byId.get(c.parentId) : null;
    if (parent) {
      const root = parent.parentId ? byId.get(parent.parentId) ?? parent : parent;
      root.replies.push(c);
    } else top.push(c);
  }
  return top;
}

