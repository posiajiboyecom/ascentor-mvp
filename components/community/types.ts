// components/community/types.ts
// ─────────────────────────────────────────────────────────────────────────
// Shared types + pure helpers for The Circle. Extracted from CommunityClient
// so the new "This Week" home components (SummitHome, CircleStatus, etc.) and
// the useChannelMessages hook can reuse them without importing the whole
// client screen. No React state or side effects live here — the Avatar
// component lives in ./ui (it's the one thing here that renders JSX).
// ─────────────────────────────────────────────────────────────────────────

export type ChannelType = 'chat' | 'forum' | 'circle' | 'announce';

export interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  default_type: ChannelType | null;
  sort_order: number;
}

export interface Channel {
  slug: string;
  name: string;
  description: string | null;
  channel_type: ChannelType;
  category_id: string;
  is_pinned?: boolean;
  is_locked?: boolean;
  sort_order: number;
  emoji?: string;
}

export interface Message {
  id: string;
  channel: string;
  user_id: string;
  content: string;
  reply_to_id?: string | null;
  created_at: string;
  profiles?: { full_name: string };
  likes: string[];
  pinned: boolean;
  dimension_tag?: string | null;
  reply_count?: number;
  is_checkin?: boolean;
  checkin_week?: string | null;
}

// ── "This Week" ritual data — computed server-side, passed to the client ──────

export interface CircleMemberStatus {
  id: string;
  name: string;
  checkedIn: boolean;
  /** The member's check-in message id this week (present when checkedIn). */
  checkinId?: string | null;
  /** Whether the current user has already cheered this check-in. */
  cheered?: boolean;
}

export interface CircleSummary {
  slug: string;
  name: string;
  members: CircleMemberStatus[];
  checkedInCount: number;
}

export interface WeekData {
  /** Monday of the current week, ISO 'YYYY-MM-DD'. */
  mondayISO: string;
  /** This week's question. */
  prompt: string;
  /** The current user's check-in message this week, if any. */
  myCheckin: Message | null;
  /** Consecutive weeks the user has checked in, ending at this/last week. */
  streakWeeks: number;
  /** Circles the user belongs to, with per-member check-in status. */
  circles: CircleSummary[];
  /** Community-wide distinct check-ins this week (honest count, no denominator). */
  communityCheckins: number;
  /** Circle-type channels the user could join (for the empty state). */
  joinableCircles: { slug: string; name: string; description: string | null }[];
}

// ── Dimension metadata (colors/emoji) ────────────────────────────────────────

export const DIMENSION_META: Record<
  string,
  { emoji: string; color: string; bg: string; border: string }
> = {
  Mind:          { emoji: '🧠', color: '#3B82F6', bg: 'rgba(59,130,246,0.08)',  border: 'rgba(59,130,246,0.22)'  },
  Vocation:      { emoji: '⚡', color: '#7C3AED', bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.22)' },
  Character:     { emoji: '🏛', color: '#0891B2', bg: 'rgba(8,145,178,0.08)',  border: 'rgba(8,145,178,0.22)'  },
  Relationships: { emoji: '🤝', color: '#E11D48', bg: 'rgba(225,29,72,0.08)',  border: 'rgba(225,29,72,0.22)'  },
  Community:     { emoji: '🌍', color: '#16A34A', bg: 'rgba(22,163,74,0.08)',  border: 'rgba(22,163,74,0.22)'  },
  Legacy:        { emoji: '🏆', color: '#C8A96E', bg: 'rgba(200,169,110,0.08)', border: 'rgba(200,169,110,0.22)' },
};

export const FORUM_DIMENSIONS = ['All', 'Mind', 'Vocation', 'Character', 'Relationships', 'Community', 'Legacy'];
export const POSTABLE_DIMENSIONS = FORUM_DIMENSIONS.slice(1);

// ── Pure helpers ─────────────────────────────────────────────────────────────

export function getInitials(name: string) {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/**
 * fmtTime — relative for messages < 24h old, absolute + timezone abbreviation
 * for anything older. Meaningful across a global community (Lagos, London, LA).
 */
export function fmtTime(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMin = Math.floor((now - then) / 60_000);
  const diffHr = Math.floor((now - then) / 3_600_000);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;

  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'short',
  });
}

export function fmtTimeTooltip(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true, timeZoneName: 'long',
  });
}

export function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (d.toDateString() === now.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';

  return d.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

const AVATAR_COLORS = ['#534AB7', '#0891B2', '#059669', '#D97706', '#DC2626', '#A8894E'];
const userColorCache: Record<string, string> = {};
export function avatarColor(userId: string) {
  if (!userColorCache[userId]) {
    let h = 0;
    for (let i = 0; i < userId.length; i++) h = userId.charCodeAt(i) + ((h << 5) - h);
    userColorCache[userId] = AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
  }
  return userColorCache[userId];
}

/** Parses `[voice:<url>]` content produced by the voice-upload route. */
export function parseVoiceContent(content: string): string | null {
  const match = content.match(/^\[voice:(.+)\]$/);
  return match ? match[1] : null;
}
