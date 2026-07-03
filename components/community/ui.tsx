// components/community/ui.tsx
// Small shared UI primitives for The Circle. Kept separate from types.ts so
// that file stays pure (no JSX). Avatar is used everywhere: channel list,
// message bubbles, forum cards, circle rosters, online rail.

import { avatarColor, getInitials } from './types';

export function Avatar({
  name,
  userId,
  size = 32,
}: {
  name: string;
  userId: string;
  size?: number;
}) {
  const color = avatarColor(userId);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full font-medium"
      style={{
        width: size,
        height: size,
        backgroundColor: `${color}26`,
        color,
        fontSize: size * 0.36,
        border: `0.5px solid ${color}4D`,
      }}
    >
      {getInitials(name)}
    </span>
  );
}
