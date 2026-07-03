'use client';

// components/community/CircleStatus.tsx
// "Your Circle this week" — member cards with real check-in status pulled from
// weekData. A "Cheer" adds a 👏 reaction to that member's check-in message
// (real, reuses community_messages.likes). Empty state lets you join a circle.

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Avatar } from './ui';
import type { CircleSummary } from './types';

export function CircleStatus({
  circles,
  joinableCircles,
  userId,
  onCheckInClick,
  myCheckedIn,
}: {
  circles: CircleSummary[];
  joinableCircles: { slug: string; name: string; description: string | null }[];
  userId: string;
  onCheckInClick: () => void;
  myCheckedIn: boolean;
}) {
  const supabase = createClient();
  const [cheered, setCheered] = useState<Record<string, boolean>>({});
  const [joining, setJoining] = useState<string | null>(null);

  async function cheer(checkinId: string) {
    if (cheered[checkinId]) return;
    setCheered((c) => ({ ...c, [checkinId]: true })); // optimistic
    const { data, error } = await supabase
      .from('community_messages')
      .select('likes')
      .eq('id', checkinId)
      .single();
    if (error || !data) {
      setCheered((c) => ({ ...c, [checkinId]: false }));
      return;
    }
    const key = `${userId}:👏`;
    if (data.likes?.includes(key)) return; // already cheered server-side
    const next = [...(data.likes ?? []), key];
    const { error: upErr } = await supabase
      .from('community_messages')
      .update({ likes: next })
      .eq('id', checkinId);
    if (upErr) setCheered((c) => ({ ...c, [checkinId]: false }));
  }

  async function join(slug: string) {
    setJoining(slug);
    try {
      await fetch('/api/community/circle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug }),
      });
      // A full refresh picks up the new roster; simplest reliable path.
      if (typeof window !== 'undefined') window.location.reload();
    } finally {
      setJoining(null);
    }
  }

  // ── Empty state: not in a circle yet ──
  if (circles.length === 0) {
    return (
      <section>
        <SectionHeading title="Your Circle" hint="weekly accountability" />
        <div className="rounded-2xl border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] px-5 py-6 text-center">
          <p className="text-sm text-[var(--color-text-primary)] font-medium mb-1">You&apos;re not in a circle yet</p>
          <p className="text-[13px] text-[var(--color-text-secondary)] mb-4 max-w-sm mx-auto">
            A circle is a small group that answers the weekly question together. Join one to see who&apos;s showing up.
          </p>
          {joinableCircles.length > 0 ? (
            <div className="flex flex-wrap gap-2 justify-center">
              {joinableCircles.slice(0, 4).map((c) => (
                <button
                  key={c.slug}
                  type="button"
                  onClick={() => join(c.slug)}
                  disabled={joining === c.slug}
                  className="rounded-full bg-[#C8A96E] px-4 py-1.5 text-[13px] font-semibold text-[#0F0F0E] disabled:opacity-50"
                >
                  {joining === c.slug ? 'Joining…' : `Join ${c.name}`}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[var(--color-text-secondary)]">No circles are open right now — check back soon.</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <section>
      {circles.map((circle) => (
        <div key={circle.slug} className="mb-5 last:mb-0">
          <SectionHeading
            title={circle.name}
            hint={`${circle.checkedInCount} of ${circle.members.length} checked in`}
          />
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(148px, 1fr))' }}>
            {circle.members.map((m) => {
              const isMe = m.id === userId;
              const didCheer = m.checkinId ? cheered[m.checkinId] || m.cheered : false;
              return (
                <div
                  key={m.id}
                  className="relative rounded-2xl border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-secondary)] px-3 py-4 text-center"
                >
                  <span
                    className="absolute top-3 right-3 h-2 w-2 rounded-full"
                    style={{ background: m.checkedIn ? '#22c55e' : 'var(--color-border-secondary)' }}
                  />
                  <div className="flex justify-center mb-2">
                    <Avatar name={m.name} userId={m.id} size={46} />
                  </div>
                  <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate">
                    {isMe ? 'You' : m.name}
                  </p>
                  <p className={`text-[11px] mt-0.5 ${m.checkedIn ? 'text-green-500' : 'text-[var(--color-text-secondary)]'}`}>
                    {m.checkedIn ? '✓ Checked in' : 'Not yet'}
                  </p>

                  {isMe && !myCheckedIn ? (
                    <button
                      type="button"
                      onClick={onCheckInClick}
                      className="mt-3 w-full rounded-lg border-[0.5px] border-[#C8A96E]/40 bg-[#C8A96E]/10 py-1.5 text-[12px] font-medium text-[#C8A96E]"
                    >
                      Check in →
                    </button>
                  ) : !isMe && m.checkedIn && m.checkinId ? (
                    <button
                      type="button"
                      onClick={() => cheer(m.checkinId!)}
                      disabled={!!didCheer}
                      className="mt-3 w-full rounded-lg border-[0.5px] border-[var(--color-border-secondary)] py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] disabled:opacity-60"
                    >
                      {didCheer ? '👏 Cheered' : 'Cheer 👏'}
                    </button>
                  ) : (
                    <div className="mt-3 h-[30px]" aria-hidden="true" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}

function SectionHeading({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">{title}</h3>
      {hint && <span className="text-xs text-[var(--color-text-secondary)]">{hint}</span>}
    </div>
  );
}
