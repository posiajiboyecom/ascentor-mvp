'use client';

// app/(app)/learn/[courseId]/CourseDetailClient.tsx
// Course Detail screen. Desktop: video player + course info + tabs on
// the left, lesson list sidebar on the right, matching
// desktop-course-detail.html. Mobile: single column, lesson list
// becomes a section below the video instead of a side rail.
//
// video_url parsing: the `lessons` table was empty when this format
// was decided (no rows to reverse-engineer the real convention from),
// so the parser below accepts a full YouTube URL (watch?v=, youtu.be/,
// or already /embed/) OR a bare 11-character video ID, rather than
// betting on one format. If lessons.video_url turns out to store
// something else entirely (Vimeo, a Mux playback ID, etc.), this
// needs revisiting — it cannot be verified without real data.

import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { ChevronLeft, Play, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ── Types — match the real schema ────────────────────────────────────

export interface CourseRow {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  category: string | null;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | null;
  duration: string | null;
  plan_tier: string | null;
  total_duration_seconds: number | null;
}

export interface LessonRow {
  id: string;
  course_id: string;
  title: string;
  description: string | null;
  video_url: string;
  duration_seconds: number | null;
  order_index: number | null;
  key_takeaways: string[] | null;
  quiz: unknown | null;
  progress_percent: number;
  last_position: number;
  completed: boolean;
}

export interface NextCourseRow {
  id: string;
  title: string;
  category: string | null;
}

export interface CourseDetailClientProps {
  course: CourseRow;
  lessons: LessonRow[];
  userId: string;
  nextCourse: NextCourseRow | null;
}

// ── Defensive video ID extraction ────────────────────────────────────

function extractYouTubeId(videoUrl: string): string | null {
  if (!videoUrl) return null;
  const trimmed = videoUrl.trim();

  // Already a bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const url = new URL(trimmed);
    if (url.hostname.includes('youtu.be')) {
      return url.pathname.slice(1) || null;
    }
    if (url.hostname.includes('youtube.com')) {
      if (url.pathname.startsWith('/embed/')) {
        return url.pathname.replace('/embed/', '') || null;
      }
      const v = url.searchParams.get('v');
      if (v) return v;
    }
  } catch {
    // Not a valid URL — fall through
  }

  return null;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

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

function DiffDots({ difficulty }: { difficulty: CourseRow['difficulty'] }) {
  const colors = DIFFICULTY_COLORS[difficulty ?? 'beginner'];
  return (
    <span className="flex items-center gap-[3px]">
      {colors.map((color, i) => (
        <span key={i} className="h-[5px] w-[5px] rounded-full" style={{ backgroundColor: color }} />
      ))}
    </span>
  );
}

// ── Lesson list item ──────────────────────────────────────────────────

function LessonItem({
  lesson,
  index,
  active,
  onClick,
}: {
  lesson: LessonRow;
  index: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`
        flex items-center gap-2.5 lg:gap-3 w-full rounded-xl px-2.5 py-2.5 mb-0.5 text-left
        transition-colors
        ${active ? 'bg-[#C8A96E]/10 border-[0.5px] border-[#C8A96E]/30' : 'hover:bg-[var(--bg-input)]'}
      `}
    >
      <span
        className={`
          flex h-6 w-6 lg:h-[26px] lg:w-[26px] shrink-0 items-center justify-center rounded-full
          ${lesson.completed ? 'bg-green-600' : active ? 'bg-[#C8A96E]' : 'border-[1.5px] border-[var(--border)]'}
        `}
      >
        {lesson.completed ? (
          <Check className="w-3 h-3 text-white" strokeWidth={3} />
        ) : active ? (
          <Play className="w-2.5 h-2.5 text-[#0F0F0E]" fill="#0F0F0E" />
        ) : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-semibold text-[var(--text-dim)] mb-0.5">
          Lesson {index + 1}
        </span>
        <span
          className={`block text-[13px] font-semibold truncate ${
            lesson.completed ? 'text-[var(--text-dim)]' : 'text-[var(--text)]'
          }`}
        >
          {lesson.title}
        </span>
      </span>
      <span className="shrink-0 text-[10.5px] text-[var(--text-dim)]">
        {formatDuration(lesson.duration_seconds)}
      </span>
    </button>
  );
}

// ── Main component ───────────────────────────────────────────────────

type Tab = 'overview' | 'notes' | 'discussion';

export function CourseDetailClient({ course, lessons, userId, nextCourse }: CourseDetailClientProps) {
  const supabase = useRef(createClient()).current;
  const [allLessons, setAllLessons] = useState(lessons);
  const [tab, setTab] = useState<Tab>('overview');

  // Active lesson: first incomplete one, or the last one if all done,
  // or null if there are no lessons at all.
  const [activeLessonId, setActiveLessonId] = useState<string | null>(() => {
    const firstIncomplete = lessons.find((l) => !l.completed);
    return firstIncomplete?.id ?? lessons[lessons.length - 1]?.id ?? null;
  });

  // ── Notes state ─────────────────────────────────────────────────────────
  const [noteContent, setNoteContent] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load note for the active lesson whenever it changes
  useEffect(() => {
    if (!activeLessonId) return;
    setNoteContent('');
    setNoteSaved(false);
    supabase
      .from('course_notes')
      .select('content')
      .eq('user_id', userId)
      .eq('lesson_id', activeLessonId)
      .maybeSingle()
      .then(({ data }) => { if (data) setNoteContent(data.content); });
  }, [activeLessonId, supabase, userId]);

  function handleNoteChange(val: string) {
    setNoteContent(val);
    setNoteSaved(false);
    if (noteTimer.current) clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => saveNote(val), 1200);
  }

  async function saveNote(content: string) {
    if (!activeLessonId) return;
    setNoteSaving(true);
    await supabase.from('course_notes').upsert(
      { user_id: userId, lesson_id: activeLessonId, course_id: course.id, content, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,lesson_id' }
    );
    setNoteSaving(false);
    setNoteSaved(true);
  }

  // ── Discussion state ─────────────────────────────────────────────────────
  const [posts, setPosts] = useState<any[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postDraft, setPostDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [profileCache, setProfileCache] = useState<Record<string, string>>({});

  async function loadDiscussion() {
    setPostsLoading(true);
    const { data } = await supabase
      .from('course_discussions')
      .select('id, content, created_at, user_id, reply_to_id')
      .eq('course_id', course.id)
      .order('created_at', { ascending: true });

    const rows = data ?? [];
    // Enrich with names
    const unknownIds = [...new Set(rows.map((r: any) => r.user_id))].filter(id => !profileCache[id]);
    if (unknownIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', unknownIds);
      const next: Record<string, string> = { ...profileCache };
      (profiles ?? []).forEach((p: any) => { next[p.id] = p.full_name || 'Member'; });
      setProfileCache(next);
    }
    setPosts(rows);
    setPostsLoading(false);
  }

  // Load discussion when tab opens
  useEffect(() => {
    if (tab === 'discussion' && posts.length === 0) loadDiscussion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  async function handlePost() {
    const text = postDraft.trim();
    if (!text || posting) return;
    setPosting(true);
    const { data, error } = await supabase
      .from('course_discussions')
      .insert({ course_id: course.id, user_id: userId, content: text, reply_to_id: replyTo?.id ?? null })
      .select('id, content, created_at, user_id, reply_to_id')
      .single();
    setPosting(false);
    if (!error && data) {
      setPosts(prev => [...prev, data]);
      setProfileCache(prev => ({ ...prev, [userId]: prev[userId] ?? 'You' }));
    }
    setPostDraft('');
    setReplyTo(null);
  }

  async function handleDeletePost(postId: string) {
    await supabase.from('course_discussions').delete().eq('id', postId).eq('user_id', userId);
    setPosts(prev => prev.filter(p => p.id !== postId && p.reply_to_id !== postId));
  }

  const activeLesson = allLessons.find((l) => l.id === activeLessonId) ?? null;
  const activeIndex = allLessons.findIndex((l) => l.id === activeLessonId);

  const videoId = activeLesson ? extractYouTubeId(activeLesson.video_url) : null;

  const completedCount = allLessons.filter((l) => l.completed).length;
  const overallProgress =
    allLessons.length > 0 ? Math.round((completedCount / allLessons.length) * 100) : 0;

  async function markComplete() {
    if (!activeLesson) return;
    const wasComplete = activeLesson.completed;

    setAllLessons((prev) =>
      prev.map((l) => (l.id === activeLesson.id ? { ...l, completed: !wasComplete } : l))
    );

    // NOTE: onConflict assumes a unique constraint on (user_id, lesson_id)
    // in user_progress. That constraint was never confirmed via
    // information_schema — only the columns themselves were verified. If
    // it doesn't exist, this upsert will insert duplicate rows instead of
    // updating in place. Check `select conname from pg_constraint where
    // conrelid = 'user_progress'::regclass` before relying on this.
    const { error } = await supabase.from('user_progress').upsert(
      {
        user_id: userId,
        course_id: course.id,
        lesson_id: activeLesson.id,
        completed: !wasComplete,
        progress_percent: !wasComplete ? 100 : activeLesson.progress_percent,
      },
      { onConflict: 'user_id,lesson_id' }
    );

    if (error) {
      console.error('[CourseDetailClient] progress update failed:', error.message);
      setAllLessons((prev) =>
        prev.map((l) => (l.id === activeLesson.id ? { ...l, completed: wasComplete } : l))
      );
    }
  }

  return (
    <div className="h-full overflow-y-auto lg:overflow-hidden lg:flex">
      <main className="lg:flex-1 lg:min-w-0 lg:overflow-y-auto pb-24 lg:pb-16">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2.5 px-4 lg:px-9 pt-4 lg:pt-[18px]">
          <Link
            href="/learn"
            className="flex items-center gap-1.5 text-[13px] font-semibold text-[var(--text-dim)] hover:text-[var(--text)]"
          >
            <ChevronLeft className="w-[15px] h-[15px]" />
            Resources
          </Link>
          {course.category && (
            <>
              <span className="text-[var(--border)] text-[13px]">/</span>
              <span className="text-[13px] text-[var(--text-dim)]">
                {categoryEmoji(course.category)} {course.category}
              </span>
            </>
          )}
        </div>

        {/* Video player */}
        <div className="px-4 lg:px-9 pt-3 lg:pt-4">
          <div className="relative w-full aspect-video rounded-2xl bg-[#0F0F0E] overflow-hidden flex items-center justify-center">
            {videoId ? (
              <iframe
                key={videoId}
                src={`https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`}
                title={activeLesson?.title ?? course.title}
                className="absolute inset-0 w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-white/60">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#C8A96E]">
                  <Play className="w-6 h-6 text-[#0F0F0E]" fill="#0F0F0E" />
                </span>
                <p className="text-xs">Video unavailable</p>
              </div>
            )}
            {activeLesson && (
              <>
                <span className="absolute bottom-3 lg:bottom-4 left-3 lg:left-4 z-10 rounded-lg bg-black/40 backdrop-blur-sm px-3 py-1.5 text-[11px] font-bold text-white">
                  Lesson {activeIndex + 1} of {allLessons.length}
                </span>
                {activeLesson.duration_seconds && (
                  <span className="absolute bottom-3 lg:bottom-4 right-3 lg:right-4 z-10 rounded-lg bg-black/40 backdrop-blur-sm px-3 py-1.5 text-[11px] font-bold text-white">
                    {formatDuration(activeLesson.duration_seconds)}
                  </span>
                )}
              </>
            )}
          </div>
        </div>

        {/* Course info */}
        <div className="px-4 lg:px-9 pt-4 lg:pt-[22px]">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-3 mb-3.5">
            <div className="min-w-0">
              <h1 className="text-lg lg:text-2xl font-extrabold text-[var(--text)] mb-2">
                {activeLesson?.title ?? course.title}
              </h1>
              <div className="flex flex-wrap items-center gap-2">
                {course.category && (
                  <span className="rounded-lg bg-[#C8A96E]/10 border-[0.5px] border-[#C8A96E]/25 px-2.5 py-1 text-[11.5px] font-semibold text-[#A8894E]">
                    {categoryEmoji(course.category)} {course.category}
                  </span>
                )}
                <span className="rounded-lg bg-[var(--bg-input)] border-[0.5px] border-[var(--border)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--text-dim)]">
                  {allLessons.length} lessons{course.duration ? ` · ${course.duration}` : ''}
                </span>
                {course.difficulty && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-[var(--bg-input)] border-[0.5px] border-[var(--border)] px-2.5 py-1 text-[11.5px] font-semibold text-[var(--text-dim)] capitalize">
                    {course.difficulty}
                    <DiffDots difficulty={course.difficulty} />
                  </span>
                )}
              </div>
            </div>

            {activeLesson && (
              <button
                type="button"
                onClick={markComplete}
                className={`
                  shrink-0 flex items-center gap-1.5 rounded-xl px-4 lg:px-5 py-2.5 text-[13px] font-bold
                  ${
                    activeLesson.completed
                      ? 'border-[0.5px] border-[var(--border)] text-[var(--text-dim)]'
                      : 'bg-[#C8A96E] text-[#0F0F0E]'
                  }
                `}
              >
                <Check className="w-[15px] h-[15px]" strokeWidth={2.5} />
                {activeLesson.completed ? 'Lesson complete' : 'Mark lesson complete'}
              </button>
            )}
          </div>

          <p className="text-sm leading-relaxed text-[var(--text-muted)] max-w-2xl mb-5 lg:mb-6">
            {activeLesson?.description ?? course.description}
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-6 border-b-[0.5px] border-[var(--border)] px-4 lg:px-9">
          {(
            [
              ['overview', 'Overview'],
              ['notes', 'My Notes'],
              ['discussion', 'Discussion'],
            ] as [Tab, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`relative py-3 text-[13.5px] font-semibold ${
                tab === key ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
              }`}
            >
              {label}
              {tab === key && (
                <span className="absolute -bottom-px left-0 right-0 h-[2px] bg-[#C8A96E]" />
              )}
            </button>
          ))}
        </div>

        <div className="px-4 lg:px-9 py-5 lg:py-6 max-w-2xl">
          {tab === 'overview' && (
            <>
              {activeLesson?.key_takeaways && activeLesson.key_takeaways.length > 0 && (
                <>
                  <h3 className="text-sm font-bold text-[var(--text)] mb-2.5">What you&apos;ll take away</h3>
                  <ul className="mb-5 flex flex-col gap-2">
                    {activeLesson.key_takeaways.map((point, i) => (
                      <li key={i} className="flex gap-2.5 items-start">
                        <Check className="w-[15px] h-[15px] text-[#C8A96E] shrink-0 mt-0.5" strokeWidth={2.5} />
                        <span className="text-[13.5px] leading-relaxed text-[var(--text-muted)]">{point}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              <h3 className="text-sm font-bold text-[var(--text)] mb-2.5">About this course</h3>
              <p className="text-sm leading-relaxed text-[var(--text-muted)]">{course.description}</p>
            </>
          )}
          {tab === 'notes' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-[var(--text)]">
                  {activeLesson ? `Notes for: ${activeLesson.title}` : 'My Notes'}
                </h3>
                <span className="text-[11px] text-[var(--text-dim)]">
                  {noteSaving ? 'Saving…' : noteSaved ? 'Saved ✓' : ''}
                </span>
              </div>

              {!activeLesson ? (
                <p className="text-sm text-[var(--text-dim)]">Select a lesson to take notes.</p>
              ) : (
                <>
                  <textarea
                    value={noteContent}
                    onChange={(e) => handleNoteChange(e.target.value)}
                    placeholder="Type your notes here. They're saved automatically as you type."
                    rows={10}
                    className="w-full resize-none rounded-xl border-[0.5px] border-[var(--border)] bg-[var(--bg-input)] px-4 py-3 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--text-dim)] outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E] transition-colors"
                  />
                  <p className="mt-2 text-[11px] text-[var(--text-dim)]">
                    Notes are private to you and tied to this lesson.
                  </p>
                </>
              )}
            </div>
          )}

          {tab === 'discussion' && (
            <div>
              <h3 className="text-sm font-bold text-[var(--text)] mb-4">Discussion</h3>

              {postsLoading ? (
                <p className="text-sm text-[var(--text-dim)]">Loading…</p>
              ) : (
                <>
                  {/* Thread */}
                  <div className="flex flex-col gap-5 mb-6">
                    {posts.filter(p => !p.reply_to_id).length === 0 && (
                      <p className="text-sm text-[var(--text-dim)]">No posts yet — start the conversation.</p>
                    )}
                    {posts.filter(p => !p.reply_to_id).map((post) => {
                      const replies = posts.filter(r => r.reply_to_id === post.id);
                      const isOwn = post.user_id === userId;
                      return (
                        <div key={post.id}>
                          {/* Top-level post */}
                          <div className="flex gap-3">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#C8A96E]/20 text-[11px] font-bold text-[#A8894E]">
                              {(profileCache[post.user_id] ?? 'M')[0].toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline gap-2 mb-0.5">
                                <span className="text-[13px] font-semibold text-[var(--text)]">
                                  {profileCache[post.user_id] ?? 'Member'}
                                </span>
                                <span className="text-[11px] text-[var(--text-dim)]">
                                  {new Date(post.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed text-[var(--text-muted)] whitespace-pre-wrap break-words">{post.content}</p>
                              <div className="flex gap-3 mt-1.5">
                                <button
                                  type="button"
                                  onClick={() => setReplyTo(replyTo?.id === post.id ? null : post)}
                                  className="text-[11px] font-medium text-[var(--text-dim)] hover:text-[#C8A96E]"
                                >
                                  Reply
                                </button>
                                {isOwn && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeletePost(post.id)}
                                    className="text-[11px] font-medium text-[var(--text-dim)] hover:text-red-500"
                                  >
                                    Delete
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Replies */}
                          {replies.length > 0 && (
                            <div className="ml-10 mt-3 flex flex-col gap-3 border-l-[0.5px] border-[var(--border)] pl-4">
                              {replies.map((reply) => (
                                <div key={reply.id} className="flex gap-3">
                                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--bg-input)] text-[10px] font-bold text-[var(--text-dim)]">
                                    {(profileCache[reply.user_id] ?? 'M')[0].toUpperCase()}
                                  </span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-0.5">
                                      <span className="text-[12px] font-semibold text-[var(--text)]">
                                        {profileCache[reply.user_id] ?? 'Member'}
                                      </span>
                                      <span className="text-[10px] text-[var(--text-dim)]">
                                        {new Date(reply.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <p className="text-[13px] leading-relaxed text-[var(--text-muted)] whitespace-pre-wrap break-words">{reply.content}</p>
                                    {reply.user_id === userId && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeletePost(reply.id)}
                                        className="text-[11px] font-medium text-[var(--text-dim)] hover:text-red-500 mt-1"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Compose */}
                  <div className="border-t-[0.5px] border-[var(--border)] pt-4">
                    {replyTo && (
                      <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-lg bg-[var(--bg-input)] text-[12px] text-[var(--text-dim)]">
                        <span>Replying to <strong className="text-[var(--text)]">{profileCache[replyTo.user_id] ?? 'Member'}</strong></span>
                        <button type="button" onClick={() => setReplyTo(null)} className="text-[var(--text-dim)] hover:text-[var(--text)]">✕</button>
                      </div>
                    )}
                    <textarea
                      value={postDraft}
                      onChange={(e) => setPostDraft(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost(); }}
                      placeholder={replyTo ? 'Write a reply…' : 'Ask a question or share a thought…'}
                      rows={3}
                      className="w-full resize-none rounded-xl border-[0.5px] border-[var(--border)] bg-[var(--bg-input)] px-4 py-3 text-sm leading-relaxed text-[var(--text)] placeholder:text-[var(--text-dim)] outline-none focus-visible:ring-2 focus-visible:ring-[#C8A96E]"
                    />
                    <div className="flex justify-end mt-2">
                      <button
                        type="button"
                        onClick={handlePost}
                        disabled={!postDraft.trim() || posting}
                        className="rounded-full bg-[#C8A96E] px-5 py-2 text-sm font-semibold text-[#0F0F0E] disabled:opacity-40"
                      >
                        {posting ? 'Posting…' : replyTo ? 'Reply' : 'Post'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Lesson sidebar */}
      <aside className="lg:w-[340px] lg:shrink-0 border-t-[0.5px] lg:border-t-0 lg:border-l-[0.5px] border-[var(--border)] bg-[var(--bg-card)] flex flex-col lg:overflow-hidden">
        <div className="px-4 lg:px-5 py-4 lg:py-5 border-b-[0.5px] border-[var(--border)]">
          <p className="text-sm font-bold text-[var(--text)] mb-2">Course content</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-[var(--text-dim)]">
                {completedCount}/{allLessons.length} lessons
              </span>
              <span className="text-[11px] font-semibold" style={{ color: '#A8894E' }}>
                {Math.round(overallProgress)}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-[var(--bg-input)] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#C8A96E] transition-all duration-500"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        </div>

        <div className="lg:flex-1 lg:overflow-y-auto px-2.5 lg:px-3 py-2.5">
          {allLessons.map((lesson, i) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              index={i}
              active={lesson.id === activeLessonId}
              onClick={() => setActiveLessonId(lesson.id)}
            />
          ))}
        </div>

        {nextCourse && (
          <Link
            href={`/learn/${nextCourse.id}`}
            className="m-4 rounded-xl border-[0.5px] border-[var(--border)] bg-[var(--bg-input)] p-3.5"
          >
            <p className="text-[9.5px] font-bold uppercase tracking-[0.06em] text-[var(--text-dim)] mb-1.5">
              Up next in {nextCourse.category}
            </p>
            <p className="text-[12.5px] font-bold text-[var(--text)]">
              {categoryEmoji(nextCourse.category)} {nextCourse.title}
            </p>
          </Link>
        )}
      </aside>
    </div>
  );
}
