'use client';

// ─────────────────────────────────────────────────────────────────
// ASCENTOR · Learn Page — Supabase-connected
//
// WHAT CHANGED (was fully hardcoded):
//   - Fetches courses from `courses` table (is_published = true)
//   - Fetches user_progress rows and merges into course list
//   - "Start Learning" upserts a user_progress row (progress = 1%)
//   - Category filter pills derived dynamically from DB results
//   - Skeleton loader while fetching
//   - Plan gate: free users see courses but get upgrade prompt on click
// ─────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

type CourseDifficulty = 'beginner' | 'intermediate' | 'advanced';

interface Course {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category: string | null;
  difficulty: CourseDifficulty | null;
  duration: string | null;
  sort_order: number;
  is_published: boolean;
}

interface CourseWithProgress extends Course {
  progress_percent: number;
  completed: boolean;
}

const DIFF_STYLE: Record<string, { bg: string; color: string }> = {
  beginner:     { bg: 'rgba(16,185,129,0.09)',  color: 'var(--success)' },
  intermediate: { bg: 'rgba(59,130,246,0.09)',  color: 'var(--blue)'    },
  advanced:     { bg: 'rgba(239,68,68,0.09)',   color: 'var(--error)'   },
};

function SkeletonCard() {
  return (
    <div className="rounded-xl p-5 animate-pulse"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <div className="flex gap-3.5 items-start">
        <div className="w-12 h-12 rounded-lg shrink-0" style={{ background: 'var(--bg-input)' }} />
        <div className="flex-1 space-y-2">
          <div className="h-4 rounded w-3/4" style={{ background: 'var(--bg-input)' }} />
          <div className="h-3 rounded w-1/2" style={{ background: 'var(--bg-input)' }} />
          <div className="h-1.5 rounded-full w-full" style={{ background: 'var(--bg-input)' }} />
        </div>
      </div>
    </div>
  );
}

export default function LearnPage() {
  const supabase = createClient();
  const [courses,    setCourses]    = useState<CourseWithProgress[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [filter,     setFilter]     = useState('All');
  const [categories, setCategories] = useState<string[]>(['All']);
  const [canAccess,  setCanAccess]  = useState(false);
  const [starting,   setStarting]   = useState<string | null>(null);

  useEffect(() => { loadData(); }, []); // eslint-disable-line

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id)
      .single();
    setCanAccess(checkAccess(profile));

    const [coursesRes, progressRes] = await Promise.all([
      supabase.from('courses').select('*').eq('is_published', true).order('sort_order'),
      supabase.from('user_progress').select('*').eq('user_id', user.id),
    ]);

    const raw = coursesRes.data ?? [];
    const progressMap = new Map(
      (progressRes.data ?? []).map((p: any) => [p.course_id, p])
    );

    const merged: CourseWithProgress[] = raw.map((c: Course) => {
      const p = progressMap.get(c.id) as any;
      return { ...c, progress_percent: p?.progress_percent ?? 0, completed: p?.completed ?? false };
    });

    const cats = Array.from(new Set(raw.map((c: Course) => c.category).filter(Boolean))) as string[];
    setCategories(['All', ...cats]);
    setCourses(merged);
    setLoading(false);
  }

  async function handleStart(courseId: string) {
    if (!canAccess) return;
    setStarting(courseId);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setStarting(null); return; }

    const { error } = await supabase.from('user_progress').upsert(
      { user_id: user.id, course_id: courseId, progress_percent: 1, last_position: 0, completed: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,course_id' }
    );
    if (!error) {
      setCourses((prev) => prev.map((c) => c.id === courseId ? { ...c, progress_percent: 1 } : c));
    }
    setStarting(null);
  }

  const filtered = filter === 'All' ? courses : courses.filter((c) => c.category === filter);

  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
        Playbooks &amp; Frameworks
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Frameworks and playbooks from Africa&apos;s top mentors
      </p>

      {/* Upgrade banner for free users */}
      {!canAccess && !loading && (
        <Link href="/checkout">
          <div className="rounded-xl p-4 mb-5 cursor-pointer"
            style={{ background: 'rgba(232,160,32,0.07)', border: '1px solid rgba(232,160,32,0.25)' }}>
            <p className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
              Upgrade to access all courses
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Explorer plan and above unlocks the full library
            </p>
          </div>
        </Link>
      )}

      {/* Category filter pills — rendered from DB data */}
      {!loading && categories.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto mb-5 pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {categories.map((cat) => (
            <button key={cat} onClick={() => setFilter(cat)}
              className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
              style={{
                background: filter === cat ? 'var(--accent)' : 'var(--bg-card)',
                color:      filter === cat ? '#000'          : 'var(--text-muted)',
                border:     `1px solid ${filter === cat ? 'var(--accent)' : 'var(--border)'}`,
              }}>
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Course list */}
      <div className="flex flex-col gap-3">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : filtered.length === 0
            ? (
              <div className="rounded-xl p-8 text-center"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No courses published yet in this category.
                </p>
              </div>
            )
            : filtered.map((course, i) => {
                const diff     = DIFF_STYLE[course.difficulty ?? 'beginner'] ?? DIFF_STYLE.beginner;
                const progress = course.progress_percent;
                return (
                  <div key={course.id} className="rounded-xl p-5 animate-fade-up"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 0.05}s` }}>
                    <div className="flex gap-3.5 items-start">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                        style={{ background: 'rgba(232,160,32,0.07)' }}>
                        {course.youtube_id
                          ? <img src={`https://img.youtube.com/vi/${course.youtube_id}/mqdefault.jpg`}
                              alt={course.title} className="w-full h-full object-cover" />
                          : <span className="text-xl">{course.category?.[0] ?? '📚'}</span>
                        }
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start gap-2 mb-1">
                          <h3 className="text-[15px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                            {course.title}
                          </h3>
                          {course.completed && (
                            <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                              style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.19)' }}>
                              ✓ Done
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 items-center text-xs mb-2.5 flex-wrap" style={{ color: 'var(--text-dim)' }}>
                          {course.category && <span>{course.category}</span>}
                          {course.duration  && <><span>·</span><span>{course.duration}</span></>}
                          {course.difficulty && (
                            <><span>·</span>
                              <span className="px-1.5 py-0.5 rounded text-[10px]" style={diff}>
                                {course.difficulty}
                              </span>
                            </>
                          )}
                        </div>

                        {progress > 0 && progress < 100 && (
                          <div className="w-full h-1 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-input)' }}>
                            <div className="h-full rounded-full transition-all duration-700"
                              style={{ width: `${progress}%`, background: 'var(--accent)' }} />
                          </div>
                        )}

                        {progress === 0 && !course.completed && (
                          canAccess ? (
                            <button onClick={() => handleStart(course.id)} disabled={starting === course.id}
                              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
                              style={{ border: '1px solid var(--border)', color: 'var(--text)', background: 'transparent' }}>
                              {starting === course.id ? 'Starting…' : 'Start Learning'}
                            </button>
                          ) : (
                            <Link href="/checkout">
                              <button className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                                style={{ border: '1px solid var(--accent)', color: 'var(--accent)', background: 'transparent' }}>
                                Upgrade to Access
                              </button>
                            </Link>
                          )
                        )}

                        {progress > 0 && progress < 100 && canAccess && (
                          <button className="mt-1 px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'var(--accent)', color: '#000', border: 'none' }}>
                            Continue — {progress}%
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
        }
      </div>
    </div>
  );
}

function checkAccess(profile: any): boolean {
  if (!profile) return false;
  const { subscription_plan, subscription_status, subscription_end } = profile;
  if (!['active', 'trialing'].includes(subscription_status ?? '')) return false;
  if (subscription_end && new Date(subscription_end) < new Date()) return false;
  return subscription_plan !== 'free';
}
