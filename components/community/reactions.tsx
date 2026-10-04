// components/community/reactions.tsx
// The Circle's reaction vocabulary. Reactions are icons, not emoji. They are
// stored in community_messages.likes as "<userId>:<reactionId>" strings, so the
// ids below are a stable contract. Any stored value that is not a known id
// (older rows from before this vocabulary existed) is shown as a plain "like".

import { ThumbsUp, Heart, Flame, HandHeart, Sparkles, Lightbulb, type LucideIcon } from 'lucide-react';

export interface Reaction {
  id: string;
  label: string;
  Icon: LucideIcon;
}

export const REACTIONS: readonly Reaction[] = [
  { id: 'like',    label: 'Like',    Icon: ThumbsUp },
  { id: 'love',    label: 'Love',    Icon: Heart },
  { id: 'fire',    label: 'Fire',    Icon: Flame },
  { id: 'support', label: 'Support', Icon: HandHeart },
  { id: 'cheer',   label: 'Cheer',   Icon: Sparkles },
  { id: 'insight', label: 'Insight', Icon: Lightbulb },
] as const;

const BY_ID = new Map(REACTIONS.map((r) => [r.id, r]));
const FALLBACK = BY_ID.get('like')!;

/** Resolves a stored reaction id (or legacy value) to a displayable reaction. */
export function reactionById(id: string): Reaction {
  return BY_ID.get(id) ?? FALLBACK;
}

/** The reaction id inside a stored "<userId>:<reactionId>" entry, normalised. */
export function reactionIdFromEntry(entry: string): string {
  const raw = entry.split(':')[1] ?? '';
  return BY_ID.has(raw) ? raw : FALLBACK.id;
}

export function ReactionGlyph({ id, size = 14 }: { id: string; size?: number }) {
  const { Icon } = reactionById(id);
  return <Icon size={size} aria-hidden="true" />;
}
