'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

const COURSES = [
  { id: 'course-1', title: 'The GROW Model for Coaching Conversations', category: 'Frameworks', difficulty: 'beginner', lessons: 5, duration: '25 min', emoji: '🌱', youtube_id: 'YGmlLc7oTG0' },
  { id: 'course-2', title: 'Navigating Hierarchical Cultures', category: 'African Context', difficulty: 'intermediate', lessons: 4, duration: '20 min', emoji: '🏛️', youtube_id: '8dHEG7WxR4c' },
  { id: 'course-3', title: 'The Art of Strategic Visibility', category: 'Career Growth', difficulty: 'intermediate', lessons: 6, duration: '30 min', emoji: '🔭', youtube_id: 'RmwbNdyrilk' },
  { id: 'course-4', title: 'Difficult Conversations Toolkit', category: 'Communication', difficulty: 'advanced', lessons: 8, duration: '40 min', emoji: '💬', youtube_id: 'PTU6hg-WzZA' },
  { id: 'course-5', title: 'Building Your Personal Board of Advisors', category: 'Networking', difficulty: 'beginner', lessons: 3, duration: '15 min', emoji: '🤝', youtube_id: '84dYijIpWjQ' },
  { id: 'course-6', title: 'Leading Without Authority', category: 'Leadership', difficulty: 'intermediate', lessons: 5, duration: '25 min', emoji: '🧭', youtube_id: '5RTFMlvbOG0' },
];

const CATEGORIES = ['All', 'Frameworks', 'African Context', 'Career Growth', 'Communication', 'Networking', 'Leadership'];

type VideoProgress = {
  [courseId: string]: {
    progress: number;
    lastPosition: number;
    completed: boolean;
  };
};

export default function LearnPage() {
  const [filter, setFilter] = useState('All');
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<VideoProgress>({});
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    loadProgress();
  }, []);

  async function loadProgress() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: progress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id);

    if (progress) {
      const progressMap: VideoProgress = {};
      for (const p of progress) {
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

  function getYouTubeEmbedUrl(youtubeId: string, startTime: number = 0) {
    if (!youtubeId) return '';
    const start = Math.floor(startTime);
    return `https://www.youtube.com/embed/${youtubeId}?start=${start}&modestbranding=1&controls=0&rel=0&showinfo=0&disablekb=1&iv_load_policy=3&playsinline=1&autoplay=1`;
  }

  function closeCourse() {
    setActiveCourse(null);
  }

  const allCourses = COURSES.map((c) => ({
    ...c,
    progress: videoProgress[c.id]?.progress || 0,
    completed: videoProgress[c.id]?.completed || false,
    lastPosition: videoProgress[c.id]?.lastPosition || 0,
  }));

  const filtered = filter === 'All'
    ? allCourses
    : allCourses.filter((c) => c.category === filter);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading courses...</p>
      </div>
    );
  }

  // Active course view
  if (activeCourse) {
    const course = allCourses.find((c) => c.id === activeCourse);
    if (!course) return null;

    return (
      <div className="animate-fade-up py-6">
        <button onClick={closeCourse}
          className="flex items-center gap-2 mb-4 text-sm"
          style={{ color: 'var(--text-muted)' }}>
          ← Back to courses
        </button>

        <h2 className="text-xl font-semibold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
          {course.title}
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
          {course.category} · {course.lessons} lessons · {course.duration}
        </p>

        {/* Video player — no YouTube controls */}
        <div className="rounded-xl overflow-hidden mb-4"
          style={{ border: '1px solid var(--border)' }}>
          <div className="relative" style={{ paddingBottom: '56.25%' }}>
            <iframe
              src={getYouTubeEmbedUrl(course.youtube_id, course.lastPosition)}
              className="absolute inset-0 w-full h-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ border: 'none' }}
            />
          </div>
        </div>

        {course.lastPosition > 0 && (
          <div className="rounded-lg px-4 py-2.5 mb-4"
            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <p className="text-xs" style={{ color: 'var(--accent)' }}>
              ▶ Resuming from {Math.floor(course.lastPosition / 60)}:{String(Math.floor(course.lastPosition % 60)).padStart(2, '0')}
            </p>
          </div>
        )}

        <div className="rounded-xl p-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>About this course</span>
            <span className="px-2 py-0.5 rounded text-[11px]"
              style={{
                background: course.difficulty === 'beginner' ? 'rgba(16,185,129,0.09)'
                  : course.difficulty === 'intermediate' ? 'rgba(59,130,246,0.09)'
                  : 'rgba(239,68,68,0.09)',
                color: course.difficulty === 'beginner' ? 'var(--success)'
                  : course.difficulty === 'intermediate' ? 'var(--blue)'
                  : 'var(--error)',
              }}>
              {course.difficulty}
            </span>
          </div>
          <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            {course.lessons} bite-sized lessons · {course.duration} total
          </p>
        </div>
      </div>
    );
  }

  // Course list view
  return (
    <div className="animate-fade-up py-6">
      <h2 className="text-2xl font-semibold mb-1"
        style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
        Learn
      </h2>
      <p className="text-sm mb-5" style={{ color: 'var(--text-muted)' }}>
        Micro-courses from Africa's top leaders
      </p>

      <div className="flex gap-1.5 overflow-x-auto mb-5 pb-1" style={{ scrollbarWidth: 'none' }}>
        {CATEGORIES.map((c) => (
          <button key={c} onClick={() => setFilter(c)}
            className="px-3.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all"
            style={{
              background: filter === c ? 'var(--accent)' : 'var(--bg-card)',
              color: filter === c ? '#000' : 'var(--text-muted)',
              border: `1px solid ${filter === c ? 'var(--accent)' : 'var(--border)'}`,
            }}>
            {c === 'All' ? 'All Courses' : c}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {filtered.map((course, i) => (
          <div key={course.id}
            onClick={() => setActiveCourse(course.id)}
            className="rounded-xl p-4 cursor-pointer transition-all hover:border-gray-600 animate-fade-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 0.05}s` }}>
            <div className="flex gap-3.5 items-start">
              {/* YouTube thumbnail */}
              <div className="w-24 h-16 rounded-lg overflow-hidden shrink-0 relative"
                style={{ background: 'var(--bg-input)' }}>
                <img
                  src={`https://img.youtube.com/vi/${course.youtube_id}/mqdefault.jpg`}
                  alt={course.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.35)' }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(245,158,11,0.9)' }}>
                    <span className="text-black text-xs ml-0.5">▶</span>
                  </div>
                </div>
              </div>

              <div className="flex-1">
                <div className="flex justify-between items-start gap-2 mb-1">
                  <h3 className="text-[14px] font-semibold leading-tight" style={{ color: 'var(--text)' }}>
                    {course.title}
                  </h3>
                  {course.completed && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold shrink-0"
                      style={{ background: 'rgba(16,185,129,0.09)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.19)' }}>
                      ✓
                    </span>
                  )}
                </div>
                <div className="flex gap-1.5 items-center text-[11px] mb-2" style={{ color: 'var(--text-dim)' }}>
                  <span>{course.category}</span>
                  <span>·</span>
                  <span>{course.duration}</span>
                  <span>·</span>
                  <span style={{
                    color: course.difficulty === 'beginner' ? 'var(--success)'
                      : course.difficulty === 'intermediate' ? 'var(--blue)'
                      : 'var(--error)',
                  }}>
                    {course.difficulty}
                  </span>
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
