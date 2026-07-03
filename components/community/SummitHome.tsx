'use client';

// components/community/SummitHome.tsx
// The "This Week" home — the default landing for The Circle. Ritual hero
// (weekly question + real streak + check-in) → your circle's check-in status
// → the Commons feed. Replaces "you land inside a dead channel".
//
// All numbers here are real: streak + circle status come from weekData
// (computed server-side from community_messages/circle_members), and the
// check-in button posts an actual reflection.

import { useMemo, useState } from 'react';
import { CircleStatus } from './CircleStatus';
import { CommonsFeed } from './CommonsFeed';
import { CheckinComposer } from './CheckinComposer';
import type { Channel, Message, WeekData } from './types';

export function SummitHome({
  weekData,
  userId,
  userName,
  isModerator,
  commonsChannel,
}: {
  weekData: WeekData;
  userId: string;
  userName: string;
  isModerator: boolean;
  commonsChannel: Channel | null;
}) {
  // Local optimistic layer over the server snapshot, updated on check-in.
  const [myCheckin, setMyCheckin] = useState<Message | null>(weekData.myCheckin);
  const [streak, setStreak] = useState(weekData.streakWeeks);
  const [showComposer, setShowComposer] = useState(false);

  const checkedIn = !!myCheckin;

  function handleCheckinDone(message: Message) {
    setMyCheckin(message);
    if (!weekData.myCheckin) setStreak((s) => s + 1); // first time this week
    setShowComposer(false);
  }

  // Reflect my own check-in immediately in the circle cards.
  const circles = useMemo(() => {
    if (!checkedIn) return weekData.circles;
    return weekData.circles.map((c) => {
      const hasMe = c.members.some((m) => m.id === userId);
      if (!hasMe) return c;
      const already = c.members.find((m) => m.id === userId)?.checkedIn;
      return {
        ...c,
        checkedInCount: already ? c.checkedInCount : c.checkedInCount + 1,
        members: c.members.map((m) =>
          m.id === userId ? { ...m, checkedIn: true, checkinId: myCheckin?.id } : m
        ),
      };
    });
  }, [weekData.circles, checkedIn, userId, myCheckin]);

  const canCheckIn = weekData.circles.length > 0;

  return (
    <div className="mx-auto w-full max-w-[860px] px-4 lg:px-8 py-6 lg:py-8 flex flex-col gap-6 lg:gap-7">
      {/* ── Ritual hero ── */}
      <section
        className="relative overflow-hidden rounded-3xl px-6 py-7 lg:px-8 lg:py-9 border-[0.5px]"
        style={{
          borderColor: 'rgba(200,169,110,0.26)',
          background:
            'linear-gradient(135deg, rgba(200,169,110,0.14), rgba(83,74,183,0.07) 65%, transparent)',
        }}
      >
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(200,169,110,0.18), transparent 70%)' }}
        />
        <div className="relative">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#C8A96E] mb-3">
            ◇ This week&apos;s ascent
          </p>
          <h1
            className="text-[24px] lg:text-[30px] leading-[1.24] text-[var(--color-text-primary)] mb-4 max-w-[560px]"
            style={{ fontFamily: 'var(--font-accent)', fontWeight: 500 }}
          >
            {weekData.prompt}
          </h1>

          <div className="flex flex-wrap items-center gap-4">
            {checkedIn ? (
              <span className="inline-flex items-center gap-2 rounded-xl border-[0.5px] border-green-500/40 bg-green-500/10 px-5 py-2.5 text-sm font-semibold text-green-400">
                ✓ Checked in this week
              </span>
            ) : (
              <button
                type="button"
                onClick={() => setShowComposer(true)}
                disabled={!canCheckIn}
                title={canCheckIn ? undefined : 'Join a circle first'}
                className="rounded-xl bg-gradient-to-b from-[#C8A96E] to-[#A8894E] px-6 py-2.5 text-sm font-semibold text-[#0F0F0E] transition hover:brightness-105 disabled:opacity-50"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Check in →
              </button>
            )}

            {streak > 0 && (
              <span className="flex items-center gap-2 text-[13px] text-[var(--color-text-secondary)]">
                🔥 <b className="text-[#C8A96E]" style={{ fontFamily: 'var(--font-display)' }}>{streak}-week</b> streak
              </span>
            )}
            {weekData.communityCheckins > 0 && (
              <span className="text-[13px] text-[var(--color-text-secondary)]">
                {weekData.communityCheckins} checked in across The Circle
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Your circle ── */}
      <CircleStatus
        circles={circles}
        joinableCircles={weekData.joinableCircles}
        userId={userId}
        onCheckInClick={() => setShowComposer(true)}
        myCheckedIn={checkedIn}
      />

      {/* ── The Commons ── */}
      {commonsChannel && (
        <section>
          <div className="flex items-center gap-2.5 mb-3">
            <h3 className="text-[15px] font-semibold text-[var(--color-text-primary)]">The Commons</h3>
            <span className="text-xs text-[var(--color-text-secondary)]">wins, questions &amp; reflections across the Circle</span>
          </div>
          <div className="rounded-2xl border-[0.5px] border-[var(--color-border-tertiary)] bg-[var(--color-background-primary)] overflow-hidden">
            <CommonsFeed channel={commonsChannel} userId={userId} userName={userName} isModerator={isModerator} />
          </div>
        </section>
      )}

      {showComposer && (
        <CheckinComposer
          prompt={weekData.prompt}
          onClose={() => setShowComposer(false)}
          onDone={handleCheckinDone}
        />
      )}
    </div>
  );
}
