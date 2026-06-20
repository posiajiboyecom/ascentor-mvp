'use client';

// app/(app)/learn/LearnClient.tsx
// Resources screen. Desktop: category filter rail + continue-learning
// hero + grouped 3-up course grid, matching desktop-resources.html.
// Mobile: single column, category rail collapses to horizontal chips.
//
// Tier gating uses lib/planTier.ts's canAccess() + TIER_META, same
// source of truth as Experts/Community.

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { Lock, Check } from 'lucide-react';
import { canAccess, TIER_META, type PlanTier } from '@/lib/planTier';

// ── Types — match the real schema, not database.ts's stale fields ──

export interface Course {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  duration: string | null;
  sort_order: number;
  is_published: boolean;
  total_duration_seconds: number | null;
  plan_tier: string | null;
  // Merged server-side from user_progress (per-lesson rows rolled up)
  progress: number;
  completed: boolean;
  updatedAt: string | null;
  // Merged server-side: count of rows in `lessons` for this course_id
  // (courses itself has no lesson-count column)
  lessonCount: number;
}

export interface LearnClientProps {
  courses: Course[];
  userPlan: PlanTier;
}

// No `emoji` column exists on courses — derive one from `category`
// instead of inventing a DB field. Extend this map as real category
// values are confirmed; falls back to a generic book icon look.
const CATEGORY_EMOJI: Record<string, string> = {
  Mind: '🧠',
  Vocation: '💼',
  Character: '🏛️',
  Relationships: '🤝',
  Community: '🌍',
  Legacy: '🏆',
};

function categoryEmoji(category: string | null): string {
  if (!category) return '📘';
  return CATEGORY_EMOJI[category] ?? '📘';
}

const DIFFICULTY_COLORS = {
  beginner: ['#14B8A6', '#E8E6E1', '#E8E6E1'],
  intermediate: ['#14B8A6', '#C8A96E', '#E8E6E1'],
  advanced: ['#14B8A6', '#C8A96E', '#534AB7'],
} as const;

function DiffDots({ difficulty, size = 5 }: { difficulty: Course['difficulty']; size?: number }) {
  const colors = DIFFICULTY_COLORS[difficulty ?? 'beginner'];
  return (
    <span className="flex items-center gap-[3px]">
      {colors.map((color, i) => (
        <span
          key={i}
          className="rounded-full"
          style={{ width: size, height: size, backgroundColor: color }}
        />
      ))}
    </span>
  );
}

function lessonCountLabel(course: Course): string {
  const parts: string[] = [];
  if (course.lessonCount > 0) {
    parts.push(`${course.lessonCount} lesson${course.lessonCount === 1 ? '' : 's'}`);
  }
  if (course.duration) {
    parts.push(course.duration);
  } else if (course.total_duration_seconds) {
    const hours = Math.floor(course.total_duration_seconds / 3600);
    const mins = Math.round((course.total_duration_seconds % 3600) / 60);
    parts.push(hours > 0 ? `${hours}h ${mins}m` : `${mins}m`);
  }
  return parts.join(' · ');
}

// ── Course card ───────────────────────────────────────────────────────────

function CourseCard({ course, userPlan, onLockedTap }: {
  course: Course;
  userPlan: PlanTier;
  onLockedTap: (course: Course) => void;
}) {
  const requiredTier = (course.plan_tier as PlanTier) || 'free';
  const locked = !canAccess(userPlan, requiredTier);
  const tierMeta = TIER_META[requiredTier];
  const isComplete = course.completed;

  const card = (
    <div
      className={`
        relative rounded-2xl border-[0.5px] bg-[var(--bg-card)] p-4 lg:p-[18px]
        transition-colors
        ${locked ? '' : 'hover:border-[#C8A96E]/40 hover:-translate-y-0.5'}
        border-[var(--border)]
      `}
    >
      <div className={locked ? 'pointer-events-none' : ''}>
        <div className="flex items-start justify-between mb-3.5">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#C8A96E]/10 border-[0.5px] border-[#C8A96E]/25 text-xl">
            {categoryEmoji(course.category)}
          </span>
          {isComplete ? (
            <span className="text-sm font-extrabold text-green-600">
              <Check className="w-4 h-4" strokeWidth={3} />
            </span>
          ) : locked ? (
            <Lock className="w-3.5 h-3.5 text-[#A8894E]" />
          ) : course.progress > 0 ? (
            <span className="text-[13px] font-extrabold text-[#A8894E]">{course.progress}%</span>
          ) : null}
        </div>

        <p className="text-sm lg:text-[14.5px] font-bold leading-snug text-[var(--text)] mb-1.5">
          {course.title}
        </p>

        <div className="flex items-center gap-1.5 mb-3">
          <span className="text-[11px] lg:text-[11.5px] text-[var(--text-dim)]">
            {lessonCountLabel(course)}
          </span>
          <DiffDots difficulty={course.difficulty} />
        </div>

        <div className="h-1 rounded-full bg-[var(--bg-input)] overflow-hidden">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, course.progress))}%`,
              backgroundColor: isComplete ? '#16A34A' : '#C8A96E',
            }}
          />
        </div>
      </div>

      {locked && (
        <button
          type="button"
          onClick={() => onLockedTap(course)}
          aria-label={`Unlock with ${tierMeta.label} plan`}
          className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-[var(--bg)]/85 backdrop-blur-[2px]"
        >
          <span
            className="flex items-center gap-1.5 rounded-full border-[0.5px] px-3.5 py-1.5 text-[11.5px] font-bold"
            style={{ color: tierMeta.color, backgroundColor: tierMeta.bg, borderColor: tierMeta.border }}
          >
            <Lock className="w-3 h-3" />
            {tierMeta.label} plan required
          </span>
        </button>
      )}
    </div>
  );

  if (locked) return card;

  return <Link href={`/learn/${course.id}`}>{card}</Link>;
}

// ── Category filter rail ─────────────────────────────────────────────────

function CategoryRail({
  categoryCounts,
  totalCount,
  activeCategory,
  onCategoryChange,
}: {
  categoryCounts: Record<string, number>;
  totalCount: number;
  activeCategory: string;
  onCategoryChange: (cat: string) => void;
}) {
  const categories = Object.keys(categoryCounts).sort();

  return (
    <>
      <p className="text-[11px] font-bold uppercase tracking-[0.07em] text-[var(--text-dim)] mb-3.5">
        Category
      </p>
      <FilterItem
        label="All"
        count={totalCount}
        active={activeCategory === 'All'}
        onClick={() => onCategoryChange('All')}
      />
      {categories.map((cat) => (
        <FilterItem
          key={cat}
          label={`${categoryEmoji(cat)} ${cat}`}
          count={categoryCounts[cat]}
          active={activeCategory === cat}
          onClick={() => onCategoryChange(cat)}
        />
      ))}
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

// ── Continue learning hero ───────────────────────────────────────────────

function ContinueHero({ course }: { course: Course }) {
  return (
    <Link
      href={`/learn/${course.id}`}
      className="flex items-center gap-4 lg:gap-6 rounded-2xl border-[0.5px] border-[#C8A96E]/25 bg-[#C8A96E]/10 p-4 lg:p-7 mb-6 lg:mb-8"
    >
      <span className="hidden lg:flex h-[90px] w-[140px] shrink-0 items-center justify-center rounded-xl bg-[#C8A96E]/20 border-[0.5px] border-[#C8A96E]/25 text-4xl">
        {categoryEmoji(course.category)}
      </span>
      <span className="flex lg:hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#C8A96E]/20 border-[0.5px] border-[#C8A96E]/25 text-xl">
        {categoryEmoji(course.category)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#A8894E] mb-1.5">
          Continue learning
        </p>
        <p className="text-base lg:text-[19px] font-extrabold text-[var(--text)] mb-1 lg:mb-1.5 truncate">
          {course.title}
        </p>
        <p className="text-xs lg:text-[13px] text-[var(--text-dim)] mb-2 lg:mb-3">
          {course.progress}% complete · {lessonCountLabel(course)}
        </p>
        <div className="hidden lg:block h-[5px] w-[280px] rounded-full bg-[#C8A96E]/20 overflow-hidden">
          <div className="h-full rounded-full bg-[#C8A96E]" style={{ width: `${course.progress}%` }} />
        </div>
      </div>
      <span className="hidden lg:inline-block shrink-0 rounded-xl bg-[#C8A96E] px-6 py-2.5 text-[13.5px] font-bold text-[#0F0F0E]">
        Resume →
      </span>
    </Link>
  );
}

// ── Main component ───────────────────────────────────────────────────────

export function LearnClient({ courses, userPlan }: LearnClientProps) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [lockedCourse, setLockedCourse] = useState<Course | null>(null);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of courses) {
      if (c.category) counts[c.category] = (counts[c.category] ?? 0) + 1;
    }
    return counts;
  }, [courses]);

  const filtered = useMemo(
    () => (activeCategory === 'All' ? courses : courses.filter((c) => c.category === activeCategory)),
    [courses, activeCategory]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, Course[]>();
    for (const c of filtered) {
      const key = c.category ?? 'Other';
      const list = map.get(key) ?? [];
      list.push(c);
      map.set(key, list);
    }
    return map;
  }, [filtered]);

  // Highest-progress, not-yet-completed course is "Continue learning".
  const continueCourse = useMemo(() => {
    const inProgress = courses.filter((c) => c.progress > 0 && !c.completed);
    if (inProgress.length === 0) return null;
    return inProgress.reduce((best, c) => (c.progress > best.progress ? c : best));
  }, [courses]);

  const completedCount = courses.filter((c) => c.completed).length;

  return (
    <div className="h-full overflow-y-auto lg:overflow-hidden lg:flex">
      <aside className="hidden lg:block w-[200px] shrink-0 border-r-[0.5px] border-[var(--border)] bg-[var(--bg-card)] px-4 py-6 overflow-y-auto">
        <CategoryRail
          categoryCounts={categoryCounts}
          totalCount={courses.length}
          activeCategory={activeCategory}
          onCategoryChange={setActiveCategory}
        />
      </aside>

      <main className="flex-1 min-w-0 lg:overflow-y-auto px-4 lg:px-9 py-5 lg:py-7 pb-24 lg:pb-16">
        <div className="flex items-center justify-between mb-4 lg:mb-6">
          <h1 className="text-xl lg:text-2xl font-extrabold text-[var(--text)]">Resources</h1>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#C8A96E]/10 border-[0.5px] border-[#C8A96E]/25 px-3 py-1 text-xs font-semibold text-[#A8894E]">
              {completedCount}/{courses.length} completed
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

        {mobileFilterOpen && (
          <div className="lg:hidden mb-4 rounded-2xl border-[0.5px] border-[var(--border)] bg-[var(--bg-card)] p-3">
            <CategoryRail
              categoryCounts={categoryCounts}
              totalCount={courses.length}
              activeCategory={activeCategory}
              onCategoryChange={setActiveCategory}
            />
          </div>
        )}

        {continueCourse && <ContinueHero course={continueCourse} />}

        {Array.from(grouped.entries()).map(([category, list]) => {
          const doneInCategory = list.filter((c) => c.completed).length;
          return (
            <div key={category}>
              <div className="flex items-center justify-between mt-7 mb-3.5 first:mt-0">
                <p className="text-sm font-bold text-[var(--text)]">
                  {categoryEmoji(category)} {category}
                </p>
                <p className="text-[11.5px] text-[var(--text-dim)]">
                  {doneInCategory}/{list.length} completed
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 lg:gap-4">
                {list.map((course) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    userPlan={userPlan}
                    onLockedTap={setLockedCourse}
                  />
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-center text-sm text-[var(--text-dim)] py-12">
            No courses in this category yet.
          </p>
        )}
      </main>

      {lockedCourse && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setLockedCourse(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-[var(--bg-card)] p-6 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <span
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                backgroundColor: TIER_META[(lockedCourse.plan_tier as PlanTier) || 'free'].bg,
                color: TIER_META[(lockedCourse.plan_tier as PlanTier) || 'free'].color,
              }}
            >
              <Lock className="w-5 h-5" />
            </span>
            <p className="text-base font-bold text-[var(--text)] mb-1.5">
              {TIER_META[(lockedCourse.plan_tier as PlanTier) || 'free'].label} plan required
            </p>
            <p className="text-sm text-[var(--text-dim)] mb-5">
              Upgrade your plan to unlock &ldquo;{lockedCourse.title}&rdquo;.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLockedCourse(null)}
                className="flex-1 rounded-lg border-[0.5px] border-[var(--border)] py-2.5 text-sm font-medium text-[var(--text-muted)]"
              >
                Not now
              </button>
              <Link
                href="/account?section=plan"
                className="flex-1 rounded-lg bg-[#C8A96E] py-2.5 text-sm font-bold text-[#0F0F0E] text-center"
              >
                Upgrade
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
