'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import UpgradePrompt from '@/components/UpgradePrompt';
import { analytics } from '@/lib/analytics';

type VideoProgress = {
  [courseId: string]: {
    progress: number;
    lastPosition: number;
    completed: boolean;
  };
};

export default function LearnPage() {
  const [courses, setCourses] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [filter, setFilter] = useState('All');
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<VideoProgress>({});
  const [loading, setLoading] = useState(true);
  const [hasAccess, setHasAccess] = useState<boolean | null>(null);
  const supabase = createClient();

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setHasAccess(false); return; }

    // Check subscription — Learn page requires paid plan
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id)
      .single();

    const isActive = profile &&
      ['active', 'trialing'].includes(profile.subscription_status) &&
      (!profile.subscription_end || new Date(profile.subscription_end) > new Date());

    // Also allow cancelled users who are still within billing period
    const isCancelledButActive = profile &&
      profile.subscription_status === 'cancelled' &&
      profile.subscription_end &&
      new Date(profile.subscription_end) > new Date();

    if (!isActive && !isCancelledButActive) {
      setHasAccess(false);
      setLoading(false);
      analytics.upgradePromptShown('learn');
      return;
    }

    setHasAccess(true);

    const [coursesRes, progressRes] = await Promise.all([
      supabase.from('courses').select('*').eq('is_published', true).order('sort_order'),
      supabase.from('user_progress').select('*').eq('user_id', user.id),
    ]);

    const coursesData = coursesRes.data || [];
    setCourses(coursesData);

    const cats = ['All', ...new Set(coursesData.map((c: any) => c.category).filter(Boolean))];
    setCategories(cats as string[]);

    if (progressRes.data) {
      const progressMap: VideoProgress = {};
      for (const p of progressRes.data) {
        progressMap[p.course_id || p.lesson_id] = {
          progress: p.progress_percent || p.watch_percentage || 0,
          lastPosition: p.last_position || 0,
          completed: p.completed || false,
        };
      }
      setVideoProgress(progressMap);
    }
    setLoading(false);
  }

  function openCourse(courseId: string) {
    setActiveCourse(courseId);
    analytics.courseViewed(courseId);
  }

  function getYouTubeEmbedUrl(youtubeId: string, startTime: number = 0) {
    if (!youtubeId) return '';
    return `https://www.youtube.com/embed/${youtubeId}?start=${Math.floor(startTime)}&modestbranding=1&controls=0&rel=0&showinfo=0&disablekb=1&iv_load_policy=3&playsinline=1&autoplay=1`;
  }

  const allCourses = courses.map((c) => ({
    ...c,
    progress: videoProgress[c.id]?.progress || 0,
    completed: videoProgress[c.id]?.completed || false,
    lastPosition: videoProgress[c.id]?.lastPosition || 0,
  }));

  const filtered = filter === 'All' ? allCourses : allCourses.filter((c) => c.category === filter);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading courses...</p>
      </div>
    );
  }

  // Block free users with UpgradePrompt
  if (hasAccess === false) {
    return <UpgradePrompt feature="learn" />;
  }

  if (activeCourse) {
    const course = allCourses.find((c) => c.id === activeCourse);
    if (!course) return null;

    return (
      <div className="animate-fade-up py-6">
        <button onClick={() => setActiveCourse(null)} className="flex items-center gap-2 mb-4 text-sm" style={{ color: 'var(--text-muted)' }}>
          ← Back to courses
        </button>
        <h2 className="text-xl font-semibold mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>{course.title}</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>{course.category} · {course.lessons} lessons · {course.duration}</p>
        <div className="rounded-xl overflow-hidden mb-4" style={{ border: '1px solid var(--border)' }}>
          <div className="relative" style={{ paddingBottom: '56.25%' }}>
            <iframe src={getYouTubeEmbedUrl(course.youtube_id, course.lastPosition)} className="absolute inset-0 w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen style={{ border: 'none' }} />
          </div>
        </div>
        {course.lastPosition > 0 && (
          <div className="rounded-lg px-4 py-2.5 mb-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <p className="text-xs" style={{ color: 'var(--accent)' }}>▶ Resuming from {Math.floor(course.lastPosition / 60)}:{String(Math.floor(course.lastPosition % 60)).padStart(2, '0')}</p>
          </div>
        )}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>About this course</span>
            <span className="px-2 py-0.5 rounded text-[11px]" style={{
              background: course.difficulty === 'beginner' ? 'rgba(16,185,129,0.09)' : course.difficulty === 'intermediate' ? 'rgba(59,130,246,0.09)' : 'rgba(239,68,68,0.09)',
              color: course.difficulty === 'beginner' ? 'var(--success)' : course.difficulty === 'intermediate' ? 'var(--blue)' : 'var(--error)',
            }}>{course.difficulty}</span>
          </div>
          {course.description && <p className="text-[13px] leading-relaxed mb-2" style={{ color: 'var(--text-muted)' }}>{course.description}</p>}
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{course.lessons} bite-sized lessons · {course.duration} total</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1" style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", color: 'var(--text)' }}>Learn</h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>Micro-courses from Africa's top leaders</p>
      <div className="flex gap-1.5 overflow-x-auto mb-5 pb-1" style={{ scrollbarWidth: 'none' }}>
        {categories.map((c) => (
          <button key={c} onClick={() => setFilter(c)} className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all" style={{
            background: filter === c ? 'var(--accent)' : 'var(--bg-card)',
            color: filter === c ? '#000' : 'var(--text-muted)',
            border: `1px solid ${filter === c ? 'var(--accent)' : 'var(--border)'}`,
          }}>{c === 'All' ? 'All Courses' : c}</button>
        ))}
      </div>
      {filtered.length === 0 && (
        <div className="text-center py-12">
          <div className="text-3xl mb-3">📚</div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No courses available yet. Check back soon!</p>
        </div>
      )}
      <div className="flex flex-col gap-3">
        {filtered.map((course, i) => (
          <div key={course.id} onClick={() => openCourse(course.id)}
            className="rounded-xl p-4 cursor-pointer transition-all hover:border-gray-600 animate-fade-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 0.05}s` }}>
            <div className="flex gap-3.5 items-start">
              <div className="w-24 h-16 rounded-lg overflow-hidden shrink-0 relative" style={{ background: 'var(--bg-input)' }}>
                {course.youtube_id ? (
                  <>
                    <img src={`https://img.youtube.com/vi/${course.youtube_id}/mqdefault.jpg`} alt={course.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.35)' }}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.9)' }}>
                        <span className="text-black text-xs ml-0.5">▶</span>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-2xl">{course.emoji || '📚'}</div>
                )}
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>{course.title}</h3>
                  {course.completed && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0" style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.19)' }}>✓</span>
                  )}
                </div>
                <div className="flex gap-1.5 items-center text-[11px] mb-2" style={{ color: 'var(--text-dim)' }}>
                  <span>{course.category}</span><span>·</span><span>{course.duration}</span><span>·</span>
                  <span style={{ color: course.difficulty === 'beginner' ? 'var(--success)' : course.difficulty === 'intermediate' ? 'var(--blue)' : 'var(--error)' }}>{course.difficulty}</span>
                </div>
                {course.progress > 0 && !course.completed && (
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full" style={{ width: `${course.progress}%`, background: 'var(--accent)' }} />
                  </div>
                )}
                {course.progress === 0 && !course.completed && (
                  <span className="text-[11px] font-medium" style={{ color: 'var(--accent)' }}>Watch →</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
