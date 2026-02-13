'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';

// Courses with YouTube video IDs
const COURSES = [
  { id: 'course-1', title: 'The GROW Model for Coaching Conversations', category: 'Frameworks', difficulty: 'beginner', lessons: 5, duration: '25 min', emoji: '🌱', youtube_id: '' },
  { id: 'course-2', title: 'Navigating Hierarchical Cultures', category: 'African Context', difficulty: 'intermediate', lessons: 4, duration: '20 min', emoji: '🏛️', youtube_id: '' },
  { id: 'course-3', title: 'The Art of Strategic Visibility', category: 'Career Growth', difficulty: 'intermediate', lessons: 6, duration: '30 min', emoji: '🔭', youtube_id: '' },
  { id: 'course-4', title: 'Difficult Conversations Toolkit', category: 'Communication', difficulty: 'advanced', lessons: 8, duration: '40 min', emoji: '💬', youtube_id: '' },
  { id: 'course-5', title: 'Building Your Personal Board of Advisors', category: 'Networking', difficulty: 'beginner', lessons: 3, duration: '15 min', emoji: '🤝', youtube_id: '' },
  { id: 'course-6', title: 'Leading Without Authority', category: 'Leadership', difficulty: 'intermediate', lessons: 5, duration: '25 min', emoji: '🧭', youtube_id: '' },
];

const CATEGORIES = ['All', 'Frameworks', 'African Context', 'Career Growth', 'Communication', 'Networking', 'Leadership'];

type VideoProgress = {
  [courseId: string]: {
    progress: number;     // 0-100
    lastPosition: number; // seconds into video
    completed: boolean;
  };
};

export default function LearnPage() {
  const [filter, setFilter] = useState('All');
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [videoProgress, setVideoProgress] = useState<VideoProgress>({});
  const [loading, setLoading] = useState(true);
  const [dbCourses, setDbCourses] = useState<any[]>([]);
  const playerRef = useRef<HTMLIFrameElement>(null);
  const supabase = createClient();

  useEffect(() => {
    loadProgress();
  }, []);

  // Save progress periodically when watching
  useEffect(() => {
    if (!activeCourse) return;

    const interval = setInterval(() => {
      saveProgress(activeCourse);
    }, 10000); // Save every 10 seconds

    return () => clearInterval(interval);
  }, [activeCourse]);

  async function loadProgress() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    // Load courses from DB if they exist
    const { data: courses } = await supabase
      .from('courses')
      .select('*')
      .order('created_at');

    if (courses && courses.length > 0) {
      setDbCourses(courses);
    }

    // Load user progress
    const { data: progress } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id);

    if (progress) {
      const progressMap: VideoProgress = {};
      for (const p of progress) {
        progressMap[p.course_id || p.lesson_id] = {
          progress: p.progress_percent || 0,
          lastPosition: p.last_position || 0,
          completed: p.completed || false,
        };
      }
      setVideoProgress(progressMap);
    }
    setLoading(false);
  }

  async function saveProgress(courseId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const current = videoProgress[courseId];
    if (!current) return;

    // Upsert progress
    await supabase.from('user_progress').upsert({
      user_id: user.id,
      course_id: courseId,
      lesson_id: courseId,
      progress_percent: current.progress,
      last_position: current.lastPosition,
      completed: current.completed,
    }, { onConflict: 'user_id,lesson_id' });
  }

  function updateVideoPosition(courseId: string, position: number, duration: number) {
    const pct = duration > 0 ? Math.round((position / duration) * 100) : 0;
    setVideoProgress((prev) => ({
      ...prev,
      [courseId]: {
        progress: pct,
        lastPosition: position,
        completed: pct >= 90,
      },
    }));
  }

  function getYouTubeEmbedUrl(youtubeId: string, startTime: number = 0) {
    if (!youtubeId) return '';
    // No YouTube controls, start from saved position
    return `https://www.youtube.com/embed/${youtubeId}?start=${Math.floor(startTime)}&modestbranding=1&controls=0&rel=0&showinfo=0&disablekb=1&iv_load_policy=3&playsinline=1&enablejsapi=1`;
  }

  function openCourse(courseId: string) {
    setActiveCourse(courseId);
  }

  function closeCourse() {
    if (activeCourse) {
      saveProgress(activeCourse);
    }
    setActiveCourse(null);
  }

  const allCourses = dbCourses.length > 0
    ? dbCourses.map((c: any) => ({
        ...c,
        progress: videoProgress[c.id]?.progress || 0,
        completed: videoProgress[c.id]?.completed || false,
      }))
    : COURSES.map((c) => ({
        ...c,
        progress: videoProgress[c.id]?.progress || 0,
        completed: videoProgress[c.id]?.completed || false,
      }));

  const filtered = filter === 'All'
    ? allCourses
    : allCourses.filter((c: any) => c.category === filter);

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="text-2xl mb-2">⏳</div>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading courses...</p>
      </div>
    );
  }

  // Active course view (full screen player)
  if (activeCourse) {
    const course = allCourses.find((c: any) => c.id === activeCourse);
    const youtubeId = course?.youtube_id;
    const lastPos = videoProgress[activeCourse]?.lastPosition || 0;

    return (
      <div className="animate-fade-up py-6">
        {/* Back button */}
        <button onClick={closeCourse}
          className="flex items-center gap-2 mb-4 text-sm"
          style={{ color: 'var(--text-muted)' }}>
          ← Back to courses
        </button>

        <h2 className="text-xl font-semibold mb-1"
          style={{ fontFamily: "'Playfair Display', serif", color: 'var(--text)' }}>
          {course?.title}
        </h2>
        <p className="text-xs mb-4" style={{ color: 'var(--text-dim)' }}>
          {course?.category} · {course?.lessons} lessons · {course?.duration}
        </p>

        {/* Video player */}
        {youtubeId ? (
          <div className="rounded-xl overflow-hidden mb-4"
            style={{ border: '1px solid var(--border)' }}>
            <div className="relative" style={{ paddingBottom: '56.25%' }}>
              <iframe
                ref={playerRef}
                src={getYouTubeEmbedUrl(youtubeId, lastPos)}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ border: 'none' }}
              />
            </div>
          </div>
        ) : (
          <div className="rounded-xl flex items-center justify-center mb-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', height: 250 }}>
            <div className="text-center">
              <div className="text-4xl mb-2">{course?.emoji}</div>
              <p className="text-sm" style={{ color: 'var(--text-dim)' }}>Video coming soon</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-dim)' }}>
                Add a YouTube video ID to this course to enable playback
              </p>
            </div>
          </div>
        )}

        {/* Progress */}
        <div className="rounded-xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Progress</span>
            <span className="text-xs font-semibold"
              style={{ color: course?.completed ? 'var(--success)' : 'var(--accent)' }}>
              {course?.completed ? '✓ Completed' : `${course?.progress || 0}%`}
            </span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${course?.progress || 0}%`,
                background: course?.completed ? 'var(--success)' : 'var(--accent)',
              }} />
          </div>
          {lastPos > 0 && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-dim)' }}>
              Resuming from {Math.floor(lastPos / 60)}:{String(Math.floor(lastPos % 60)).padStart(2, '0')}
            </p>
          )}
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

      {/* Filter pills */}
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

      {/* Course list */}
      <div className="flex flex-col gap-3">
        {filtered.map((course: any, i: number) => (
          <div key={course.id}
            onClick={() => openCourse(course.id)}
            className="rounded-xl p-5 cursor-pointer transition-all hover:border-gray-600 animate-fade-up"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', animationDelay: `${i * 0.05}s` }}>
            <div className="flex gap-3.5 items-start">
              <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl shrink-0"
                style={{ background: 'rgba(245,158,11,0.06)' }}>
                {course.emoji}
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
                <div className="flex gap-2 items-center text-xs mb-2.5" style={{ color: 'var(--text-dim)' }}>
                  <span>{course.category}</span>
                  <span>·</span>
                  <span>{course.lessons} lessons</span>
                  <span>·</span>
                  <span>{course.duration}</span>
                  <span>·</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px]"
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

                {/* Progress bar */}
                {course.progress > 0 && !course.completed && (
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${course.progress}%`, background: 'var(--accent)' }} />
                  </div>
                )}
                {course.progress === 0 && !course.completed && (
                  <span className="text-xs font-medium" style={{ color: 'var(--accent)' }}>
                    Start →
                  </span>
                )}
                {course.progress > 0 && !course.completed && (
                  <span className="text-xs mt-1 block" style={{ color: 'var(--text-dim)' }}>
                    Continue from {Math.floor((videoProgress[course.id]?.lastPosition || 0) / 60)}:{String(Math.floor((videoProgress[course.id]?.lastPosition || 0) % 60)).padStart(2, '0')}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
