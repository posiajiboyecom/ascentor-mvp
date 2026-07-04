'use client';

// app/(app)/experts/ExpertsClient.tsx
// ─────────────────────────────────────────────────────────────────────────
// Sessions screen (route: /experts). Desktop: filter rail (Dimension +
// Status facets) + live banner + grouped 2-up card grid, matching the
// "Prototype A" desktop-sessions.html. Mobile: single column, same
// grouping, filter rail collapses to horizontal chip strips.
//
// Tier gating uses lib/planTier.ts's canAccess() + TIER_META — the
// single source of truth already shared with Learn/Community per its
// own header comment.
// ============================================================

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Lock, Check } from 'lucide-react';
import { canAccess, TIER_META, type PlanTier } from '@/lib/planTier';

// ── Types — match the real schema, not database.ts's stale fields ──

export interface ExpertSession {
  id: string;
  title: string;
  expert_name: string;
  expert_bio: string | null;
  expert_avatar: string | null;
  status: 'scheduled' | 'live';
  scheduled_at: string;
  duration_minutes: number | null;
  dimension: string | null;
  plan_tier: string | null;
  meeting_url: string | null;
  registration_url: string | null;
  max_attendees: number | null;
  current_attendees: number | null;
}

export interface ExpertsClientProps {
  sessions: ExpertSession[];
  registeredIds: string[];
  userPlan: PlanTier;
  userId: string;
}

const DIMENSIONS = ['Mind', 'Character', 'Vocation', 'Relationships', 'Community', 'Legacy'];

const AVATAR_COLORS: Record<string, string> = {
  purple: '#534AB7',
  teal: '#0891B2',
  green: '#16A34A',
  gold: '#A8894E',
};

function avatarColorFor(name: string): string {
  const palette = Object.values(AVATAR_COLORS);
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

function initials(name: string): string {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Breathing live dot ───────────────────────────────────────────────────
// A small red pulsing indicator used on session cards when a session is live.

function LiveDot({ className = '' }: { className?: string }) {
  return (
    <span className={`relative inline-flex h-2.5 w-2.5 shrink-0 ${className}`}>
      <span className="absolute inset-0 rounded-full bg-red-500 opacity-40 animate-ping" />
      <span className="absolute inset-[2px] rounded-full bg-red-500" />
    </span>
  );
}

function isLive(
  scheduledAt: string,
  durationMinutes: number | null,
  status?: string,
): boolean {
  // If admin has explicitly marked the session as live, trust that.
  if (status === 'live') return true;
  // Otherwise fall back to the time-window check (5-min early + duration).
  const start = new Date(scheduledAt).getTime();
  const end = start + (durationMinutes ?? 60) * 60 * 1000;
  const now = Date.now();
  return now >= start - 5 * 60 * 1000 && now <= end;
}

function isToday(scheduledAt: string): boolean {
  return new Date(scheduledAt).toDateString() === new Date().toDateString();
}

function isThisWeek(scheduledAt: string): boolean {
  const diffDays = (new Date(scheduledAt).getTime() - Date.now()) / 86400000;
  return diffDays >= 0 && diffDays <= 7;
}

function formatSessionTime(scheduledAt: string): string {
  const date = new Date(scheduledAt);
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (isToday(scheduledAt)) return `Today · ${time}`;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`;
  return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${time}`;
}

// ── Live banner ──────────────────────────────────────────────────────────

function LiveBanner({ session }: { session: ExpertSession }) {
  return (
    <div className="flex items-center gap-3.5 lg:gap-4 rounded-2xl border-[0.5px] border-red-500/25 bg-red-500/[0.05] px-4 lg:px-5 py-3.5 lg:py-4 mb-5 lg:mb-6">
      <span className="relative w-3 h-3 shrink-0">
        <span className="absolute inset-0 rounded-full bg-red-500 opacity-30 animate-ping" />
        <span className="absolute inset-[2px] rounded-full bg-red-500" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-red-500 mb-0.5">
          Live now
        </p>
        <p className="text-sm lg:text-base font-bold text-[var(--text)] truncate">
          {session.title}
        </p>
        <p className="text-xs lg:text-sm text-[var(--text-dim)] truncate">
          with {session.expert_name}
        </p>
      </div>
      <button
        type="button"
        disabled={!session.meeting_url}
        onClick={() => {
          if (session.meeting_url) window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
        }}
        className="shrink-0 rounded-xl bg-red-500 px-4 lg:px-5 py-2.5 text-xs lg:text-sm font-bold text-white disabled:opacity-50"
      >
        Join now →
      </button>
    </div>
  );
}

// ── Session card ─────────────────────────────────────────────────────────

interface SessionCardProps {
  session: ExpertSession;
  isRegistered: boolean;
  userPlan: PlanTier;
  onToggleRegister: (session: ExpertSession) => void;
  onLockedTap: (session: ExpertSession) => void;
}

function SessionCard({
  session,
  isRegistered,
  userPlan,
  onToggleRegister,
  onLockedTap,
}: SessionCardProps) {
  const live = isLive(session.scheduled_at, session.duration_minutes, session.status);
  const today = isToday(session.scheduled_at);
  const requiredTier = (session.plan_tier as PlanTier) || 'free';
  const locked = !canAccess(userPlan, requiredTier);
  const tierMeta = TIER_META[requiredTier];
  const avatarColor = avatarColorFor(session.expert_name);

  function handleAction() {
    if (locked) {
      onLockedTap(session);
      return;
    }
    // Registered + has a join link → open it (works for both live and upcoming)
    if (isRegistered && session.meeting_url) {
      window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
      return;
    }
    // Live with no registration required (or not yet registered)
    if (live && session.meeting_url) {
      window.open(session.meeting_url, '_blank', 'noopener,noreferrer');
      return;
    }
    onToggleRegister(session);
  }

  return (
    <div
      className={`
        relative rounded-2xl border-[0.5px] bg-[var(--bg-card)] p-4 lg:p-[18px]
        transition-colors
        ${live ? 'border-red-500/30' : 'border-[var(--border)] hover:border-[#C8A96E]/40'}
      `}
    >
      <div className={locked ? 'pointer-events-none' : ''}>
        <div className="flex gap-3 mb-3.5">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold"
            style={{
              backgroundColor: `${avatarColor}29`,
              color: avatarColor,
              border: `1.5px solid ${avatarColor}`,
            }}
          >
            {initials(session.expert_name)}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <p className="text-[10.5px] font-medium text-[var(--text-dim)]">
                {formatSessionTime(session.scheduled_at)}
              </p>
              {live && (
                <span className="flex items-center gap-1 rounded-full bg-red-500/10 border-[0.5px] border-red-500/30 px-1.5 py-0.5">
                  <LiveDot />
                  <span className="text-[9px] font-bold uppercase tracking-[0.08em] text-red-500">Live</span>
                </span>
              )}
            </div>
            <p className="text-sm lg:text-[14.5px] font-bold leading-snug text-[var(--text)] mb-0.5">
              {session.title}
            </p>
            <p className="text-xs text-[var(--text-dim)]">with {session.expert_name}</p>
          </div>
        </div>

        {session.dimension && (
          <div className="flex flex-wrap gap-1.5 mb-3.5">
            <span className="rounded-full border-[0.5px] border-[var(--border)] bg-[var(--bg-input)] px-2.5 py-1 text-[10px] text-[var(--text-dim)]">
              {session.dimension}
            </span>
          </div>
        )}

        <div className="pt-3 border-t-[0.5px] border-[var(--border)]">
          {isRegistered && session.meeting_url ? (
            // ── Registered + has a join link ──────────────────────────────
            <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-2">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600 shrink-0">
                <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                Registered
              </span>
              <div className="flex items-center gap-2 flex-wrap justify-end">
                {/* Join Here primary CTA */}
                <button
                  type="button"
                  onClick={handleAction}
                  className="rounded-lg px-3.5 py-1.5 text-xs font-bold bg-[#0891B2] text-white whitespace-nowrap"
                >
                  Join Here →
                </button>
                {/* Unregister — small secondary */}
                <button
                  type="button"
                  onClick={() => onToggleRegister(session)}
                  className="rounded-lg px-2.5 py-1.5 text-[10px] font-medium border-[0.5px] border-[var(--border)] bg-transparent text-[var(--text-dim)] whitespace-nowrap"
                >
                  Unregister
                </button>
              </div>
            </div>
          ) : (
            // ── Default state: registered (no link) / locked / open ───────
            <div className="flex items-center justify-between">
              {isRegistered ? (
                <span className="flex items-center gap-1.5 text-xs font-semibold text-green-600">
                  <Check className="w-3.5 h-3.5" strokeWidth={2.5} />
                  Registered
                </span>
              ) : locked ? (
                <span className="text-xs font-medium" style={{ color: tierMeta.color }}>
                  {tierMeta.label} plan required
                </span>
              ) : (
                <span className="text-xs text-[var(--text-dim)]">Open to join</span>
              )}

              <button
                type="button"
                onClick={handleAction}
                disabled={locked}
                className={`
                  rounded-lg px-3.5 py-1.5 text-xs font-bold
                  ${
                    isRegistered
                      ? 'border-[0.5px] border-[var(--border)] bg-transparent text-[var(--text-dim)]'
                      : live
                        ? 'bg-red-500 text-white'
                        : 'bg-[#C8A96E] text-[#0F0F0E]'
                  }
                  ${locked ? 'invisible' : ''}
                `}
              >
                {isRegistered ? 'Unregister' : live ? 'Join now' : 'Register'}
              </button>
            </div>
          )}
        </div>
      </div>

      {locked && (
        <button
          type="button"
          onClick={() => onLockedTap(session)}
          aria-label={`Unlock with ${tierMeta.label} plan`}
          className="absolute bottom-0 inset-x-0 z-10 flex items-center justify-center rounded-b-2xl pt-6 pb-4 px-4"
          style={{
            background: `linear-gradient(to bottom, transparent 0%, color-mix(in srgb, var(--bg-card) 92%, transparent) 40%)`,
          }}
        >
          <span
            className="flex items-center gap-1.5 rounded-full border-[0.5px] px-4 py-1.5 text-xs font-bold"
            style={{ color: tierMeta.color, backgroundColor: tierMeta.bg, borderColor: tierMeta.border }}
          >
            <Lock className="w-3 h-3" />
            Unlock — {tierMeta.label} plan
          </span>
        </button>
      )}

      {locked && session.expert_bio && (
        <p className="text-[11px] leading-relaxed mt-2 mb-8 line-clamp-2" style={{ color: 'var(--text-dim)' }}>
          {session.expert_bio}
        </p>
      )}
    </div>
  );
}

// ── Filter rail (desktop sidebar / mobile horizontal chips) ─────────────

type StatusFilter = 'all' | 'registered' | 'open';

interface FilterRailProps {
  dimensionCounts: Record<string, number>;
  totalCount: number;
  registeredCount: number;
  activeDimension: string;
  onDimensionChange: (dim: string) => void;
  activeStatus: StatusFilter;
  onStatusChange: (status: StatusFilter) => void;
}

function FilterRail({
  dimensionCounts,
  totalCount,
  registeredCount,
  activeDimension,
  onDimensionChange,
  activeStatus,
  onStatusChange,
}: FilterRailProps) {
  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-dim)] mb-3.5">
        Dimension
      </p>
      <FilterItem
        label="All"
        count={totalCount}
        active={activeDimension === 'All'}
        onClick={() => onDimensionChange('All')}
      />
      {DIMENSIONS.map((dim) => (
        <FilterItem
          key={dim}
          label={dim}
          count={dimensionCounts[dim] ?? 0}
          active={activeDimension === dim}
          onClick={() => onDimensionChange(dim)}
        />
      ))}

      <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-dim)] mt-6 mb-3.5">
        Status
      </p>
      <FilterItem
        label="All sessions"
        active={activeStatus === 'all'}
        onClick={() => onStatusChange('all')}
      />
      <FilterItem
        label="Registered"
        count={registeredCount}
        active={activeStatus === 'registered'}
        onClick={() => onStatusChange('registered')}
      />
      <FilterItem
        label="Open to join"
        active={activeStatus === 'open'}
        onClick={() => onStatusChange('open')}
      />
    </>
  );
}

function FilterItem({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center justify-between w-full rounded-lg px-2.5 py-2 mb-0.5
        text-[13.5px] font-medium text-left transition-colors
        ${
          active
            ? 'bg-[#C8A96E]/10 text-[#A8894E] font-bold'
            : 'text-[var(--text-muted)] hover:bg-[var(--bg-input)]'
        }
      `}
    >
      <span>{label}</span>
      {typeof count === 'number' && (
        <span className="text-[11px] text-[var(--text-dim)]">{count}</span>
      )}
    </button>
  );
}

// ── Section of cards ─────────────────────────────────────────────────────

function SessionSection({
  label,
  sessions,
  registeredIds,
  userPlan,
  onToggleRegister,
  onLockedTap,
}: {
  label: string;
  sessions: ExpertSession[];
  registeredIds: Set<string>;
  userPlan: PlanTier;
  onToggleRegister: (session: ExpertSession) => void;
  onLockedTap: (session: ExpertSession) => void;
}) {
  if (sessions.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.08em] text-[var(--text-dim)] mt-7 mb-3.5 first:mt-0">
        {label}
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 lg:gap-4">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            isRegistered={registeredIds.has(session.id)}
            userPlan={userPlan}
            onToggleRegister={onToggleRegister}
            onLockedTap={onLockedTap}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function ExpertsClient({
  sessions,
  registeredIds: initialRegisteredIds,
  userPlan,
  userId,
}: ExpertsClientProps) {
  const router = useRouter();

  const [registeredIds, setRegisteredIds] = useState(new Set(initialRegisteredIds));
  const [activeDimension, setActiveDimension] = useState('All');
  const [activeStatus, setActiveStatus] = useState<StatusFilter>('all');
  const [lockedSession, setLockedSession] = useState<ExpertSession | null>(null);
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);

  async function handleToggleRegister(session: ExpertSession) {
    const isReg = registeredIds.has(session.id);

    // Optimistic update
    setRegisteredIds((prev) => {
      const next = new Set(prev);
      if (isReg) next.delete(session.id);
      else next.add(session.id);
      return next;
    });

    if (isReg) {
      // Unregister — DELETE via API route (no notification needed)
      const res = await fetch('/api/experts/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (!res.ok) {
        console.error('[ExpertsClient] unregister failed:', await res.text());
        setRegisteredIds((prev) => new Set(prev).add(session.id)); // revert
      }
    } else {
      // Register — POST via API route (triggers in-app notification + push/email)
      const res = await fetch('/api/experts/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: session.id }),
      });
      if (!res.ok) {
        console.error('[ExpertsClient] register failed:', await res.text());
        setRegisteredIds((prev) => {
          const next = new Set(prev);
          next.delete(session.id); // revert
          return next;
        });
        return;
      }
      if (session.registration_url) {
        window.open(session.registration_url, '_blank', 'noopener,noreferrer');
      }
    }
  }

  // ── Filtering ──
  const dimensionCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of sessions) {
      if (s.dimension) counts[s.dimension] = (counts[s.dimension] ?? 0) + 1;
    }
    return counts;
  }, [sessions]);

  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      const dimOk = activeDimension === 'All' || s.dimension === activeDimension;
      const statusOk =
        activeStatus === 'all'
          ? true
          : activeStatus === 'registered'
            ? registeredIds.has(s.id)
            : !registeredIds.has(s.id); // 'open'
      return dimOk && statusOk;
    });
  }, [sessions, activeDimension, activeStatus, registeredIds]);

  const liveSessions = filtered.filter((s) => isLive(s.scheduled_at, s.duration_minutes, s.status));
  // Today includes live sessions too — the prototype shows the live session
  // both in the LiveBanner AND as its own card in the Today grid below it.
  const todaySessions = filtered.filter(
    (s) => isToday(s.scheduled_at)
  );
  const thisWeekSessions = filtered.filter(
    (s) => !isToday(s.scheduled_at) && isThisWeek(s.scheduled_at)
  );
  const comingUpSessions = filtered.filter(
    (s) => !isToday(s.scheduled_at) && !isThisWeek(s.scheduled_at)
  );

  const featuredLive = liveSessions[0] ?? null;

  const sectionProps = {
    registeredIds,
    userPlan,
    onToggleRegister: handleToggleRegister,
    onLockedTap: setLockedSession,
  };

  return (
    <div className="h-full overflow-y-auto lg:overflow-hidden lg:flex">
      {/* ── Desktop filter rail ── */}
      <aside className="hidden lg:block w-[220px] shrink-0 border-r-[0.5px] border-[var(--border)] bg-[var(--bg-card)] px-4 py-6 overflow-y-auto">
        <FilterRail
          dimensionCounts={dimensionCounts}
          totalCount={sessions.length}
          registeredCount={registeredIds.size}
          activeDimension={activeDimension}
          onDimensionChange={setActiveDimension}
          activeStatus={activeStatus}
          onStatusChange={setActiveStatus}
        />
      </aside>

      <main className="flex-1 min-w-0 lg:overflow-y-auto px-4 lg:px-9 py-5 lg:py-7 pb-24 lg:pb-16">
        <div className="flex items-center justify-between mb-4 lg:mb-5">
          <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text)]">Sessions</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#C8A96E]/10 border-[0.5px] border-[#C8A96E]/25 px-3 py-1 text-xs font-semibold text-[#A8894E]">
              {sessions.length} upcoming
            </span>
            <button
              type="button"
              onClick={() => setMobileFilterOpen((o) => !o)}
              className="lg:hidden rounded-full border-[0.5px] border-[var(--border)] px-3 py-1 text-xs font-medium text-[var(--text-muted)]"
            >
              Filters
            </button>
          </div>
        </div>

        {/* Mobile filter chips — horizontal scrollable chip rows */}
        {mobileFilterOpen && (
          <div className="lg:hidden mb-4 rounded-2xl border-[0.5px] border-[var(--border)] bg-[var(--bg-card)] p-3">
            {/* Dimension chips */}
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--text-dim)] mb-2">Dimension</p>
            <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3">
              {(['All', ...DIMENSIONS]).map((dim) => (
                <button
                  key={dim}
                  type="button"
                  onClick={() => setActiveDimension(dim)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors
                    ${activeDimension === dim
                      ? 'bg-[#C8A96E]/15 text-[#A8894E] border-[0.5px] border-[#C8A96E]/40'
                      : 'border-[0.5px] border-[var(--border)] text-[var(--text-muted)]'}`}
                >
                  {dim} {dim !== 'All' && dimensionCounts[dim] ? `(${dimensionCounts[dim]})` : dim === 'All' ? `(${sessions.length})` : ''}
                </button>
              ))}
            </div>
            {/* Status chips */}
            <p className="text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--text-dim)] mb-2">Status</p>
            <div className="flex gap-1.5">
              {([
                { id: 'all' as StatusFilter, label: 'All' },
                { id: 'registered' as StatusFilter, label: `Registered (${registeredIds.size})` },
                { id: 'open' as StatusFilter, label: 'Open' },
              ]).map(({ id, label }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveStatus(id)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold whitespace-nowrap transition-colors
                    ${activeStatus === id
                      ? 'bg-[#C8A96E]/15 text-[#A8894E] border-[0.5px] border-[#C8A96E]/40'
                      : 'border-[0.5px] border-[var(--border)] text-[var(--text-muted)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {featuredLive && <LiveBanner session={featuredLive} />}

        <SessionSection label="Today" sessions={todaySessions} {...sectionProps} />
        <SessionSection label="This week" sessions={thisWeekSessions} {...sectionProps} />
        <SessionSection label="Coming up" sessions={comingUpSessions} {...sectionProps} />

        {filtered.length === 0 && (
          <p className="text-center text-sm text-[var(--text-dim)] py-12">
            No sessions match these filters.
          </p>
        )}
      </main>

      {/* ── Tier upgrade modal ── */}
      {lockedSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setLockedSession(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: TIER_META[(lockedSession.plan_tier as PlanTier) || 'free'].bg,
                color: TIER_META[(lockedSession.plan_tier as PlanTier) || 'free'].color,
              }}
            >
              <Lock className="w-5 h-5" />
            </span>
            <p className="text-base font-bold text-[var(--text)] mb-1.5">
              {TIER_META[(lockedSession.plan_tier as PlanTier) || 'free'].label} plan required
            </p>
            <p className="text-sm text-[var(--text-dim)] mb-5">
              Upgrade your plan to register for &ldquo;{lockedSession.title}&rdquo;.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLockedSession(null)}
                className="flex-1 rounded-lg border-[0.5px] border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-muted)]"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => router.push('/account?section=plan')}
                className="flex-1 rounded-lg bg-[#C8A96E] py-2.5 text-sm font-bold text-[#0F0F0E]"
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
