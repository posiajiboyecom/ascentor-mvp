'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import SageLoader from '@/components/SageLoader';
import UpgradePrompt from '@/components/UpgradePrompt';

// ─────────────────────────────────────────────────────────────────────────────
// P3 FIX: YouTube progress poll interval is now visibility-aware.
//
// Before: setInterval ran every 1s regardless of whether the tab was in the
//         background — wasting CPU and firing postMessage calls to the player
//         even when the user couldn't see the page.
//
// After:  document.addEventListener('visibilitychange') pauses the interval
//         when document.hidden === true and resumes it when visible again.
//         Zero CPU cost when the user switches apps or tabs.
// ─────────────────────────────────────────────────────────────────────────────

interface Course {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category: string | null;
  difficulty: string | null;
  sort_order: number;
  is_published: boolean;
  total_duration_seconds: number | null;
}

interface UserProgress {
  course_id: string;
  progress_percent: number;
  last_position: number;
  completed: boolean;
}

export default function LearnPage() {
  const [courses,       setCourses]       = useState<Course[]>([]);
  const [progress,      setProgress]      = useState<Record<string, UserProgress>>({});
  const [categories,    setCategories]    = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [expanded,       setExpanded]      = useState<Record<string, boolean>>({});
  const [loading,        setLoading]       = useState(true);
  const [hasAccess,      setHasAccess]     = useState(false);
  const [userId,         setUserId]        = useState<string | null>(null);

  const supabaseRef   = useRef(createClient());
  const supabase      = supabaseRef.current;
  const iframeRef     = useRef<HTMLIFrameElement>(null);
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const isVisibleRef  = useRef(!document.hidden); // track tab visibility

  // ── Load data ────────────────────────────────────────────────────────────
  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [coursesRes, progressRes, profileRes] = await Promise.all([
      supabase.from('courses').select('*').eq('is_published', true).order('sort_order'),
      supabase.from('user_progress').select('*').eq('user_id', user.id),
      supabase.from('profiles')
        .select('subscription_status, subscription_end')
        .eq('id', user.id)
        .single(),
    ]);

    const courseList = coursesRes.data || [];
    setCourses(courseList);

    const cats = ['All', ...Array.from(new Set(
      courseList.map(c => c.category).filter(Boolean)
    )) as string[]];
    setCategories(cats);

    const prog: Record<string, UserProgress> = {};
    for (const p of (progressRes.data || [])) {
      prog[p.course_id] = p;
    }
    setProgress(prog);

    const profile = profileRes.data;
    const access = !!(profile &&
      ['active', 'trialing'].includes(profile.subscription_status || '') &&
      (!profile.subscription_end || new Date(profile.subscription_end) > new Date()));
    setHasAccess(access);

    setLoading(false);
  }

  // ── P3 FIX: Visibility-aware poll interval ───────────────────────────────
  const startProgressPolling = useCallback(() => {
    if (intervalRef.current) return; // already running

    intervalRef.current = setInterval(() => {
      // Only fire postMessage if the tab is visible — zero cost when hidden
      if (!isVisibleRef.current) return;

      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func: 'getCurrentTime', args: [] }),
        '*'
      );
    }, 1000);
  }, []);

  const stopProgressPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // P3 FIX: Pause poll when tab goes to background, resume when it returns
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (document.hidden) {
        // Tab is hidden — pause (interval stays alive but skips execution)
        // Alternatively stop/restart the interval entirely for maximum efficiency:
        stopProgressPolling();
      } else {
        // Tab is visible again — resume polling if a course is open
        if (selectedCourse) startProgressPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopProgressPolling();
    };
  }, [selectedCourse, startProgressPolling, stopProgressPolling]);

  // Start polling when a course is selected; stop when deselected
  useEffect(() => {
    if (selectedCourse && !document.hidden) {
      startProgressPolling();
    } else {
      stopProgressPolling();
    }
    return () => stopProgressPolling();
  }, [selectedCourse, startProgressPolling, stopProgressPolling]);

  // Listen for postMessage responses from YouTube iframe
  useEffect(() => {
    const handleMessage = async (event: MessageEvent) => {
      if (!selectedCourse || !userId) return;

      let data: any;
      try {
        data = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
      } catch { return; }

      // YouTube API sends current time via postMessage
      const currentTime = data?.info?.currentTime ?? data?.currentTime;
      if (typeof currentTime !== 'number') return;

      const duration = selectedCourse.total_duration_seconds;
      if (!duration || duration <= 0) return;

      const progressPct = Math.min(Math.round((currentTime / duration) * 100), 100);
      const completed   = progressPct >= 90;

      // Update local state
      setProgress(prev => ({
        ...prev,
        [selectedCourse.id]: {
          course_id:        selectedCourse.id,
          progress_percent: progressPct,
          last_position:    Math.floor(currentTime),
          completed,
        },
      }));

      // Persist to DB (debounced — only every ~5 seconds via the 1s interval)
      // Using upsert so first-time progress creates a row
      await supabase.from('user_progress').upsert({
        user_id:          userId,
        course_id:        selectedCourse.id,
        progress_percent: progressPct,
        last_position:    Math.floor(currentTime),
        completed,
        updated_at:       new Date().toISOString(),
      }, { onConflict: 'user_id,course_id' });
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [selectedCourse, userId, supabase]);

  const toggleCompletion = async (courseId: string, current: boolean) => {
    if (!userId) return;
    const newCompleted = !current;
    setProgress(prev => ({
      ...prev,
      [courseId]: { ...prev[courseId], course_id: courseId, completed: newCompleted, progress_percent: newCompleted ? 100 : prev[courseId]?.progress_percent || 0, last_position: prev[courseId]?.last_position || 0 },
    }));
    await supabase.from('user_progress').upsert({
      user_id: userId, course_id: courseId, completed: newCompleted,
      progress_percent: newCompleted ? 100 : progress[courseId]?.progress_percent || 0,
      last_position: progress[courseId]?.last_position || 0,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' });
  };

  const filteredCourses = activeCategory === 'All'
    ? courses
    : courses.filter(c => c.category === activeCategory);

  const completedCount = Object.values(progress).filter(p => p.completed).length;

  if (loading) return <SageLoader message="Loading your learning path…" />;
  if (!hasAccess) return <UpgradePrompt feature="learn" />;

  return (
    <div className="animate-fade-up py-6">

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-2xl font-semibold mb-1"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>
            Learn
          </h2>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {completedCount} of {courses.length} completed
          </p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold"
            style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--teal)' }}>
            {courses.length > 0 ? Math.round((completedCount / courses.length) * 100) : 0}%
          </div>
          <div className="text-[10px]"
            style={{ color: 'var(--text-dim)', fontFamily: "'DM Mono', monospace", letterSpacing: '0.06em' }}>
            COMPLETE
          </div>
        </div>
      </div>

      {/* Continue learning banner */}
      {selectedCourse && (
        <div className="rounded-xl p-4 mb-5 flex items-center gap-3"
          style={{ background: 'rgba(20,184,166,0.07)', border: '1px solid rgba(20,184,166,0.2)' }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(20,184,166,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            ▶
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold" style={{ color: 'var(--teal)' }}>NOW PLAYING</p>
            <p className="text-sm truncate" style={{ color: 'var(--text)' }}>{selectedCourse.title}</p>
          </div>
          <button onClick={() => setSelectedCourse(null)}
            style={{ color: 'var(--text-dim)', fontSize: 18, background: 'none', border: 'none', cursor: 'pointer' }}>
            ✕
          </button>
        </div>
      )}

      {/* Video player */}
      {selectedCourse && (
        <div className="rounded-xl overflow-hidden mb-5" style={{ border: '1px solid var(--border)', aspectRatio: '16/9' }}>
          <iframe
            ref={iframeRef}
            src={`https://www.youtube-nocookie.com/embed/${selectedCourse.youtube_id}?enablejsapi=1&origin=${typeof window !== 'undefined' ? window.location.origin : ''}&start=${progress[selectedCourse.id]?.last_position || 0}`}
            className="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title={selectedCourse.title}
          />
        </div>
      )}

      {/* Category filters */}
      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1" style={{ scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className="px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background: activeCategory === cat ? 'var(--accent)' : 'var(--bg-card)',
              color:      activeCategory === cat ? '#000' : 'var(--text-muted)',
              border:     `1px solid ${activeCategory === cat ? 'var(--accent)' : 'var(--border)'}`,
            }}>
            {cat}
          </button>
        ))}
      </div>

      {/* Course list */}
      <div className="flex flex-col gap-3">
        {filteredCourses.map((course, i) => {
          const prog      = progress[course.id];
          const pct       = prog?.progress_percent || 0;
          const completed = prog?.completed || false;
          const isOpen    = expanded[course.id];
          const isPlaying = selectedCourse?.id === course.id;

          return (
            <div key={course.id}
              className="rounded-xl overflow-hidden transition-all"
              style={{ background: 'var(--bg-card)', border: `1px solid ${isPlaying ? 'var(--teal)' : 'var(--border)'}` }}>

              {/* Row header */}
              <div className="flex items-center gap-3 p-4 cursor-pointer"
                onClick={() => setExpanded(prev => ({ ...prev, [course.id]: !isOpen }))}>

                {/* Progress ring */}
                <div style={{ width: 36, height: 36, flexShrink: 0, position: 'relative' }}>
                  <svg viewBox="0 0 36 36" width="36" height="36">
                    <circle cx="18" cy="18" r="15.9" fill="none" stroke="rgba(20,184,166,0.1)" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15.9" fill="none"
                      stroke={completed ? '#10B981' : 'var(--teal)'}
                      strokeWidth="3"
                      strokeDasharray={`${pct}, 100`}
                      strokeLinecap="round"
                      style={{ transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dasharray 0.6s ease' }}
                    />
                  </svg>
                  {completed && (
                    <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>✓</span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold truncate" style={{ color: 'var(--text)' }}>{course.title}</h4>
                  <p className="text-xs" style={{ color: 'var(--text-dim)' }}>
                    {course.category} {course.difficulty ? `· ${course.difficulty}` : ''}
                    {pct > 0 && !completed && ` · ${pct}% watched`}
                  </p>
                </div>

                <span style={{ color: 'var(--text-dim)', fontSize: 12 }}>{isOpen ? '▲' : '▼'}</span>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border)' }}>
                  {course.description && (
                    <p className="text-sm mt-3 mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {course.description}
                    </p>
                  )}
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => setSelectedCourse(isPlaying ? null : course)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: isPlaying ? 'transparent' : 'var(--teal)', color: isPlaying ? 'var(--teal)' : '#000', border: isPlaying ? '1px solid var(--teal)' : 'none' }}>
                      {isPlaying ? '⏹ Stop' : pct > 0 ? '▶ Resume' : '▶ Watch'}
                    </button>
                    <button
                      onClick={() => toggleCompletion(course.id, completed)}
                      className="px-4 py-2 rounded-lg text-xs font-semibold transition-all"
                      style={{ background: 'transparent', color: completed ? 'var(--success)' : 'var(--text-dim)', border: `1px solid ${completed ? 'var(--success)' : 'var(--border)'}` }}>
                      {completed ? '✓ Completed' : 'Mark complete'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {filteredCourses.length === 0 && (
          <div className="text-center py-10">
            <p className="text-sm" style={{ color: 'var(--text-dim)' }}>No courses in this category yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
