'use client';

// components/community/TodayPanel.tsx
// The right-hand "Today in #channel" rail from the desktop screenshot.
// Pure presentational — takes everything as props. The parent
// CommunityClient (your real, existing component) owns data-fetching
// and realtime/presence wiring.
//
// NOTE on "This Week's Pulse": the prototype's "38 of 50 logged a win"
// implies a win-logging feature that doesn't exist in the schema (no
// table, no UI to log a win). Per an earlier decision in this project,
// the safer substitute is a REAL derivable number — e.g. distinct
// members who've posted in the last 7 days — rather than a fabricated
// stat. `pulseLabel`/`pulseValue`/`pulseSubtext` are left generic so
// you can feed either, but I'd default to the real one.

import { Pin } from 'lucide-react';

export interface PulseStat {
  label: string;
  value: string;
  subtext: string;
  progressPct?: number;
  accent?: 'gold' | 'purple';
}

export interface PinnedItem {
  id: string;
  author: string;
  text: string;
}

export interface OnlineMember {
  id: string;
  name: string;
  initials: string;
  location: string;
  role: string;
  avatarColor?: string;
}

interface TodayPanelProps {
  channelName: string;
  pulseStats: PulseStat[];
  pinnedItems: PinnedItem[];
  onlineMembers: OnlineMember[];
  onlineCount: number;
}

export function TodayPanel({
  channelName,
  pulseStats,
  pinnedItems,
  onlineMembers,
  onlineCount,
}: TodayPanelProps) {
  return (
    <aside className="hidden xl:flex xl:flex-col w-[300px] shrink-0 border-l border-[var(--color-border-tertiary)] h-full overflow-y-auto px-5 py-6">
      <p className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)] mb-5">
        Today in #{channelName}
      </p>

      {pulseStats.length > 0 && (
        <section className="mb-6">
          <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)] mb-3">
            This week&apos;s pulse
          </h2>
          <div className="flex flex-col gap-2.5">
            {pulseStats.map((stat) => {
              const isPurple = stat.accent === 'purple';
              return (
                <div
                  key={stat.label}
                  className={`
                    rounded-xl px-4 py-3 border-[0.5px]
                    ${
                      isPurple
                        ? 'bg-[#534AB7]/[0.08] border-[#534AB7]/20'
                        : 'bg-[var(--color-background-secondary)] border-[var(--color-border-tertiary)]'
                    }
                  `}
                >
                  <p
                    className="text-[10px] font-medium uppercase tracking-[0.06em] mb-1.5"
                    style={{ color: isPurple ? '#534AB7' : 'var(--color-text-secondary)' }}
                  >
                    {stat.label}
                  </p>
                  <p className="flex items-baseline gap-1.5">
                    <span
                      className="text-2xl font-medium"
                      style={{ color: isPurple ? '#534AB7' : 'var(--color-text-primary)' }}
                    >
                      {stat.value}
                    </span>
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {stat.subtext}
                    </span>
                  </p>
                  {typeof stat.progressPct === 'number' && (
                    <div className="mt-2 h-1 rounded-full bg-[var(--color-background-primary)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#C8A96E]"
                        style={{ width: `${Math.min(100, Math.max(0, stat.progressPct))}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {pinnedItems.length > 0 && (
        <section className="mb-6">
          <h2 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)] mb-3">
            <Pin className="w-3 h-3 text-[#C8A96E]" aria-hidden="true" />
            Pinned
          </h2>
          <div className="flex flex-col gap-2.5">
            {pinnedItems.map((item) => (
              <div
                key={item.id}
                className="rounded-xl bg-[#C8A96E]/[0.06] border-[0.5px] border-[#C8A96E]/20 px-4 py-3"
              >
                <p className="text-xs font-medium text-[#A8894E] mb-1">{item.author}</p>
                <p className="text-sm text-[var(--color-text-primary)] leading-snug">
                  {item.text}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-xs font-medium uppercase tracking-[0.06em] text-[var(--color-text-secondary)] mb-3">
          Online — {onlineCount}
        </h2>
        <div className="flex flex-col gap-3">
          {onlineMembers.map((member) => (
            <div key={member.id} className="flex items-center gap-2.5">
              <span className="relative shrink-0">
                <span
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-medium"
                  style={{
                    backgroundColor: `${member.avatarColor ?? '#534AB7'}26`,
                    color: member.avatarColor ?? '#534AB7',
                  }}
                >
                  {member.initials}
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-[var(--color-background-primary)]" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                  {member.name}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)] truncate">
                  {member.location} · {member.role}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </aside>
  );
}
