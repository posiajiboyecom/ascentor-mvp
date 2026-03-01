'use client';

import SageLoader from '@/components/SageLoader';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import UpgradePrompt from '@/components/UpgradePrompt';
import { analytics } from '@/lib/analytics';

// ─── Brand tokens ────────────────────────────────────────────
const B = {
  dark:       '#0C0B08',
  dark800:    '#141310',
  dark700:    '#1E1C17',
  dark600:    '#2E2A22',
  dark500:    '#4A4438',
  dark400:    '#7A7260',
  dark200:    '#D4CFC3',
  gold:       '#E8A020',
  goldDark:   '#B9760A',
  goldMuted:  'rgba(232,160,32,0.09)',
  goldBorder: 'rgba(232,160,32,0.22)',
  success:    '#10B981',
  border:     'rgba(212,207,195,0.10)',
  fontDisplay:"'Cormorant Garamond', Georgia, serif",
  fontUI:     "'Syne', system-ui, sans-serif",
  fontMono:   "'DM Mono', monospace",
};

// ─── Types ───────────────────────────────────────────────────
type Course = {
  id: string;
  title: string;
  description?: string;
  category: string;
  difficulty: string;
  duration: string;
  lessons: number;
  emoji: string;
  youtube_id: string;
  sort_order: number;
  total_duration_seconds?: number;
  is_published: boolean;
  // computed
  progress: number;
  completed: boolean;
  lastPosition: number;
  updatedAt?: string;
};

type Section = {
  category: string;
  courses: Course[];
  totalCompleted: number;
};

const COMPLETION_THRESHOLD = 0.90; // 90%

// ─── Utility ─────────────────────────────────────────────────
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function diffColor(d: string) {
  if (d === 'beginner')     return '#14B8A6';
  if (d === 'intermediate') return B.gold;
  return '#8B5CF6';
}

// ─── Continue Learning Banner ─────────────────────────────────
function ContinueBanner({ course, onResume }: { course: Course; onResume: () => void }) {
  const pct = Math.round(course.progress);
  return (
    <div onClick={onResume} style={{
      cursor: 'pointer',
      marginBottom: 24,
      borderRadius: 14,
      overflow: 'hidden',
      border: `1px solid ${B.goldBorder}`,
      background: B.dark700,
      position: 'relative',
    }}>
      {/* Thumbnail strip */}
      {course.youtube_id && (
        <div style={{ position: 'relative', height: 90, overflow: 'hidden' }}>
          <img
            src={`https://img.youtube.com/vi/${course.youtube_id}/mqdefault.jpg`}
            alt={course.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.45)' }}
          />
          {/* Play button overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: B.gold,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(232,160,32,0.5)',
            }}>
              <span style={{ color: '#000', fontSize: 14, marginLeft: 3 }}>▶</span>
            </div>
          </div>
          {/* Progress bar over thumbnail */}
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: 3, background: 'rgba(255,255,255,0.15)',
          }}>
            <div style={{ height: '100%', width: `${pct}%`, background: B.gold, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}
      <div style={{ padding: '10px 14px 12px' }}>
        <p style={{ fontFamily: B.fontMono, fontSize: 9, letterSpacing: '0.12em', textTransform: 'uppercase', color: B.gold, margin: '0 0 4px' }}>
          ▶ CONTINUE LEARNING
        </p>
        <p style={{ fontFamily: B.fontUI, fontSize: 13, fontWeight: 600, color: B.dark200, margin: '0 0 6px', lineHeight: 1.3 }}>
          {course.title}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ flex: 1, height: 4, borderRadius: 2, background: B.dark600, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${B.goldDark}, ${B.gold})`, borderRadius: 2 }} />
          </div>
          <span style={{ fontFamily: B.fontMono, fontSize: 10, color: B.dark400, flexShrink: 0 }}>{pct}%</span>
        </div>
        {course.lastPosition > 0 && (
          <p style={{ fontFamily: B.fontMono, fontSize: 9, color: B.dark500, margin: '4px 0 0', letterSpacing: '0.06em' }}>
            Resume from {formatTime(course.lastPosition)}
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Section Accordion ───────────────────────────────────────
function SectionAccordion({
  section, isOpen, onToggle, onOpenCourse,
}: {
  section: Section;
  isOpen: boolean;
  onToggle: () => void;
  onOpenCourse: (id: string) => void;
}) {
  const total = section.courses.length;
  const done  = section.totalCompleted;
  const allDone = done === total && total > 0;
  const sectionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{ marginBottom: 10, borderRadius: 14, overflow: 'hidden', border: `1px solid ${isOpen ? B.goldBorder : B.border}`, transition: 'border-color 0.2s' }}>
      {/* Section header */}
      <button onClick={onToggle} style={{
        width: '100%', textAlign: 'left',
        padding: '14px 16px',
        background: isOpen ? B.dark700 : B.dark800,
        border: 'none', cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 12,
        transition: 'background 0.2s',
      }}>
        {/* Category emoji / icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 9, flexShrink: 0,
          background: isOpen ? B.goldMuted : 'rgba(255,255,255,0.04)',
          border: `1px solid ${isOpen ? B.goldBorder : B.border}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 17, transition: 'all 0.2s',
        }}>
          {section.courses[0]?.emoji || '📚'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <p style={{ fontFamily: B.fontUI, fontSize: 14, fontWeight: 700, color: isOpen ? B.dark200 : '#9A9590', margin: 0, transition: 'color 0.2s' }}>
              {section.category}
            </p>
            {allDone && (
              <span style={{ fontSize: 11, color: B.success, fontFamily: B.fontMono }}>✓ Complete</span>
            )}
          </div>
          {/* Mini progress dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ display: 'flex', gap: 3 }}>
              {section.courses.slice(0, 8).map((c, i) => (
                <div key={i} style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: c.completed ? B.success : c.progress > 0 ? B.gold : B.dark600,
                  transition: 'background 0.3s',
                }} />
              ))}
              {total > 8 && <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.dark500 }}>+{total - 8}</span>}
            </div>
            <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.dark400, letterSpacing: '0.06em' }}>
              {done}/{total}
            </span>
          </div>
        </div>

        {/* Chevron */}
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke={isOpen ? B.gold : B.dark400} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </button>

      {/* Section body — slides open */}
      <div style={{
        maxHeight: isOpen ? `${section.courses.length * 120}px` : '0px',
        overflow: 'hidden',
        transition: 'max-height 0.4s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <div style={{ padding: '4px 12px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {section.courses.map((course, idx) => (
            <CourseCard
              key={course.id}
              course={course}
              idx={idx}
              onOpen={() => onOpenCourse(course.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Course Card ─────────────────────────────────────────────
function CourseCard({ course, idx, onOpen }: { course: Course; idx: number; onOpen: () => void }) {
  const pct = Math.round(course.progress);
  const isNew = course.progress === 0 && !course.completed;
  const isInProgress = course.progress > 0 && !course.completed;

  return (
    <div onClick={onOpen} style={{
      display: 'flex', gap: 12, alignItems: 'center',
      padding: '10px 12px',
      borderRadius: 10,
      background: B.dark700,
      border: `1px solid ${course.completed ? 'rgba(16,185,129,0.18)' : B.border}`,
      cursor: 'pointer',
      transition: 'border-color 0.2s, background 0.2s',
      animation: 'fade-in-up 0.25s ease both',
      animationDelay: `${idx * 0.04}s`,
    }}
    onMouseEnter={e => (e.currentTarget.style.borderColor = B.goldBorder)}
    onMouseLeave={e => (e.currentTarget.style.borderColor = course.completed ? 'rgba(16,185,129,0.18)' : B.border)}
    >
      {/* Thumbnail */}
      <div style={{
        width: 72, height: 50, borderRadius: 8, overflow: 'hidden',
        flexShrink: 0, position: 'relative',
        background: B.dark600,
      }}>
        {course.youtube_id ? (
          <>
            <img
              src={`https://img.youtube.com/vi/${course.youtube_id}/mqdefault.jpg`}
              alt={course.title}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div style={{
              position: 'absolute', inset: 0,
              background: 'rgba(0,0,0,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%',
                background: course.completed ? B.success : B.gold,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#000', fontSize: 8, marginLeft: course.completed ? 0 : 2 }}>
                  {course.completed ? '✓' : '▶'}
                </span>
              </div>
            </div>
            {/* Progress sliver at bottom */}
            {isInProgress && (
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.15)' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: B.gold }} />
              </div>
            )}
          </>
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
            {course.emoji}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: B.fontUI, fontSize: 12, fontWeight: 600,
          color: B.dark200, margin: '0 0 3px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{course.title}</p>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: isInProgress ? 5 : 0 }}>
          <span style={{ fontFamily: B.fontMono, fontSize: 9, color: diffColor(course.difficulty), letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {course.difficulty}
          </span>
          <span style={{ color: B.dark600, fontSize: 9 }}>·</span>
          <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.dark400 }}>{course.duration}</span>
        </div>
        {isInProgress && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ flex: 1, height: 3, borderRadius: 2, background: B.dark600, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: `linear-gradient(90deg, ${B.goldDark}, ${B.gold})`, borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.dark400, flexShrink: 0 }}>{pct}%</span>
          </div>
        )}
        {isNew && (
          <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.gold, letterSpacing: '0.06em' }}>START →</span>
        )}
        {course.completed && (
          <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.success, letterSpacing: '0.06em' }}>✓ COMPLETED</span>
        )}
      </div>
    </div>
  );
}

// ─── Video Player View ────────────────────────────────────────
function VideoPlayer({
  course,
  onBack,
  onProgressUpdate,
  onToggleComplete,
}: {
  course: Course;
  onBack: () => void;
  onProgressUpdate: (courseId: string, position: number, pct: number, completed?: boolean) => void;
  onToggleComplete: (courseId: string, completed: boolean) => void;
}) {
  const playerRef = useRef<HTMLIFrameElement>(null);
  const [currentPct, setCurrentPct] = useState(course.progress);
  const [currentPos, setCurrentPos] = useState(course.lastPosition);
  const [duration, setDuration]     = useState(course.total_duration_seconds || 0);
  const [unlocked, setUnlocked]     = useState(course.progress >= COMPLETION_THRESHOLD * 100 || course.completed);
  const [isCompleted, setIsCompleted] = useState(course.completed);
  const [playerReady, setPlayerReady] = useState(false);
  const [justUnlocked, setJustUnlocked] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSaved = useRef(0);

  // YouTube IFrame API via postMessage
  // Strategy: listen for onReady → start polling every 1s for currentTime + duration
  // This is the only reliable cross-origin approach for embedded iframes
  const pollInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const durationRef  = useRef<number>(0);

  function sendCommand(func: string, args: unknown[] = []) {
    playerRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: 'command', func, args }), '*'
    );
  }

  useEffect(() => {
    function handleMessage(e: MessageEvent) {
      try {
        const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
        if (!data) return;

        // Player ready — start polling
        if (data.event === 'onReady') {
          setPlayerReady(true);
          // Start 1-second poll for currentTime + duration
          if (pollInterval.current) clearInterval(pollInterval.current);
          pollInterval.current = setInterval(() => {
            sendCommand('getCurrentTime');
            sendCommand('getDuration');
          }, 1000);
        }

        // Player state changed (1=playing, 2=paused, 0=ended)
        if (data.event === 'onStateChange') {
          if (data.info === 0) {
            // Video ended — treat as 100%
            const dur = durationRef.current;
            if (dur > 0) {
              setCurrentPos(dur);
              setCurrentPct(100);
              setUnlocked(true);
            }
          }
        }

        // Response to getCurrentTime / getDuration commands
        if (data.event === 'infoDelivery' && data.info) {
          const info = data.info;

          // Duration response
          if (typeof info.duration === 'number' && info.duration > 0) {
            durationRef.current = info.duration;
            setDuration(info.duration);
          }

          // CurrentTime response
          if (typeof info.currentTime === 'number' && durationRef.current > 0) {
            const pos = info.currentTime;
            const dur = durationRef.current;
            const pct = (pos / dur) * 100;

            setCurrentPos(pos);
            setCurrentPct(pct);

            // Unlock at 90%
            if (pct >= COMPLETION_THRESHOLD * 100 && !unlocked) {
              setUnlocked(true);
              setJustUnlocked(true);
              setTimeout(() => setJustUnlocked(false), 3000);
            }

            // Save to DB every 5 seconds of watched time
            if (pos - lastSaved.current > 5) {
              lastSaved.current = pos;
              if (saveTimer.current) clearTimeout(saveTimer.current);
              saveTimer.current = setTimeout(() => {
                onProgressUpdate(course.id, pos, pct);
              }, 500);
            }
          }
        }
      } catch {}
    }

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
      if (pollInterval.current) clearInterval(pollInterval.current);
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [course.id, unlocked, onProgressUpdate]);

  function handleToggleComplete() {
    if (!unlocked) return;
    const newCompleted = !isCompleted;
    setIsCompleted(newCompleted);
    onToggleComplete(course.id, newCompleted);
    onProgressUpdate(course.id, currentPos, currentPct, newCompleted);
  }

  const displayPct = Math.min(100, Math.round(currentPct));
  const pctToUnlock = Math.round(COMPLETION_THRESHOLD * 100);

  return (
    <div style={{ paddingTop: 4, paddingBottom: 32 }}>
      <style>{`
        @keyframes unlock-pulse {
          0%,100% { box-shadow: 0 0 0 0 rgba(232,160,32,0); }
          50%      { box-shadow: 0 0 0 8px rgba(232,160,32,0.25); }
        }
        @keyframes fade-in-up {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes complete-bounce {
          0%   { transform: scale(1); }
          40%  { transform: scale(1.08); }
          100% { transform: scale(1); }
        }
      `}</style>

      {/* Back */}
      <button onClick={onBack} style={{
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'none', border: 'none', cursor: 'pointer',
        fontFamily: B.fontMono, fontSize: 11, color: B.dark400,
        marginBottom: 16, padding: 0, letterSpacing: '0.06em',
      }}>
        ← BACK TO COURSES
      </button>

      {/* Title */}
      <h2 style={{ fontFamily: B.fontDisplay, fontSize: 22, fontWeight: 700, color: B.dark200, margin: '0 0 4px', lineHeight: 1.2 }}>
        {course.title}
      </h2>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontFamily: B.fontMono, fontSize: 10, color: diffColor(course.difficulty), textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {course.difficulty}
        </span>
        <span style={{ color: B.dark600 }}>·</span>
        <span style={{ fontFamily: B.fontMono, fontSize: 10, color: B.dark400 }}>{course.category}</span>
        <span style={{ color: B.dark600 }}>·</span>
        <span style={{ fontFamily: B.fontMono, fontSize: 10, color: B.dark400 }}>{course.duration}</span>
      </div>

      {/* Player */}
      <div style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${B.border}`, marginBottom: 16, background: '#000' }}>
        <div style={{ position: 'relative', paddingBottom: '56.25%' }}>
          <iframe
            ref={playerRef}
            src={(() => {
              const origin = typeof window !== 'undefined' ? window.location.origin : '';
              const params = new URLSearchParams({
                start:          String(Math.floor(course.lastPosition)),
                enablejsapi:    '1',
                origin,
                rel:            '0',
                modestbranding: '1',
                controls:       '0',
                showinfo:       '0',
                iv_load_policy: '3',
                playsinline:    '1',
                autoplay:       '1',
                fs:             '0',
                disablekb:      '0',
                cc_load_policy: '0',
                widget_referrer: origin,
              });
              return `https://www.youtube.com/embed/${course.youtube_id}?${params.toString()}`;
            })()}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
          {/* Overlay blocks: cover top bar (title/share) and bottom bar (controls/YouTube logo)
              These transparent divs sit over the YouTube chrome zones so users can't interact
              with YouTube's own UI — they can still click center to play/pause */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0,
            height: '18%',
            background: 'transparent',
            zIndex: 2,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', bottom: 0, left: 0, right: 0,
            height: '18%',
            background: '#000',
            zIndex: 2,
          }} />
          {/* Center click zone — play/pause passthrough */}
          <div
            onClick={() => sendCommand('pauseVideo')}
            style={{
              position: 'absolute', top: '18%', left: 0, right: 0, bottom: '18%',
              zIndex: 1, cursor: 'pointer',
              background: 'transparent',
            }}
          />
        </div>
      </div>

      {/* Progress tracker */}
      <div style={{
        borderRadius: 12, padding: '14px 16px',
        background: B.dark700,
        border: `1px solid ${B.border}`,
        marginBottom: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: B.fontUI, fontSize: 12, fontWeight: 600, color: B.dark200 }}>Your Progress</span>
          <span style={{ fontFamily: B.fontMono, fontSize: 11, color: displayPct >= pctToUnlock ? B.gold : B.dark400 }}>
            {displayPct}%
          </span>
        </div>

        {/* Track */}
        <div style={{ position: 'relative', height: 8, borderRadius: 4, background: B.dark600, overflow: 'hidden', marginBottom: 8 }}>
          {/* Watched portion */}
          <div style={{
            height: '100%',
            width: `${displayPct}%`,
            background: displayPct >= pctToUnlock
              ? `linear-gradient(90deg, ${B.goldDark}, ${B.gold})`
              : `linear-gradient(90deg, #4A8A6A, ${B.success})`,
            borderRadius: 4,
            transition: 'width 0.6s ease',
          }} />
          {/* 90% threshold marker */}
          <div style={{
            position: 'absolute',
            left: `${pctToUnlock}%`,
            top: 0, bottom: 0,
            width: 2,
            background: B.gold,
            opacity: 0.6,
          }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.dark500, letterSpacing: '0.06em' }}>
            {currentPos > 0 ? `${formatTime(currentPos)} watched` : 'Not started'}
            {duration > 0 ? ` of ${formatTime(duration)}` : ''}
          </span>
          {!unlocked && (
            <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.dark500, letterSpacing: '0.04em' }}>
              Watch to {pctToUnlock}% to unlock
            </span>
          )}
          {unlocked && !isCompleted && (
            <span style={{ fontFamily: B.fontMono, fontSize: 9, color: B.gold, letterSpacing: '0.04em' }}>
              ✓ Ready to mark complete
            </span>
          )}
        </div>
      </div>

      {/* Mark Complete Button */}
      <button
        onClick={handleToggleComplete}
        disabled={!unlocked}
        style={{
          width: '100%',
          padding: '14px 0',
          borderRadius: 12,
          border: `1.5px solid ${
            !unlocked ? B.dark600 :
            isCompleted ? 'rgba(16,185,129,0.4)' :
            B.goldBorder
          }`,
          background: !unlocked ? B.dark800 :
            isCompleted ? 'rgba(16,185,129,0.1)' :
            justUnlocked ? B.goldMuted :
            B.goldMuted,
          fontFamily: B.fontUI,
          fontSize: 13, fontWeight: 700,
          color: !unlocked ? B.dark500 :
            isCompleted ? B.success :
            B.gold,
          cursor: unlocked ? 'pointer' : 'not-allowed',
          transition: 'all 0.3s ease',
          animation: justUnlocked ? 'unlock-pulse 0.6s ease' :
                     (isCompleted ? 'complete-bounce 0.4s ease' : 'none'),
          letterSpacing: '0.02em',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {!unlocked ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            Locked — watch to {pctToUnlock}%
          </>
        ) : isCompleted ? (
          <>✓ Completed — tap to undo</>
        ) : (
          <>Mark as Complete</>
        )}
      </button>

      {/* Description */}
      {course.description && (
        <div style={{
          marginTop: 16, borderRadius: 12, padding: '14px 16px',
          background: B.dark800, border: `1px solid ${B.border}`,
        }}>
          <p style={{ fontFamily: B.fontUI, fontSize: 12, fontWeight: 600, color: B.dark200, margin: '0 0 6px' }}>About this course</p>
          <p style={{ fontFamily: B.fontUI, fontSize: 12, color: B.dark400, margin: 0, lineHeight: 1.7 }}>{course.description}</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function LearnPage() {
  const [courses, setCourses]         = useState<Course[]>([]);
  const [sections, setSections]       = useState<Section[]>([]);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [activeCourse, setActiveCourse] = useState<string | null>(null);
  const [continueCourse, setContinueCourse] = useState<Course | null>(null);
  const [loading, setLoading]         = useState(true);
  const [hasAccess, setHasAccess]     = useState<boolean | null>(null);
  const [userId, setUserId]           = useState<string | null>(null);
  // Stable ref — never recreate on re-renders (same fix as community page)
  const supabaseRef = useRef(createClient());
  const supabase    = supabaseRef.current;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); setHasAccess(false); return; }
    setUserId(user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscription_end')
      .eq('id', user.id).single();

    const active =
      profile && ['active', 'trialing'].includes(profile.subscription_status) &&
      (!profile.subscription_end || new Date(profile.subscription_end) > new Date());
    const cancelledActive =
      profile && profile.subscription_status === 'cancelled' &&
      profile.subscription_end && new Date(profile.subscription_end) > new Date();

    if (!active && !cancelledActive) {
      setHasAccess(false); setLoading(false);
      analytics.upgradePromptShown('learn'); return;
    }
    setHasAccess(true);

    const [coursesRes, progressRes] = await Promise.all([
      supabase.from('courses').select('*').eq('is_published', true).order('sort_order'),
      supabase.from('user_progress').select('*').eq('user_id', user.id),
    ]);

    const progressMap: Record<string, { progress: number; lastPosition: number; completed: boolean; updatedAt: string }> = {};
    for (const p of (progressRes.data || [])) {
      progressMap[p.course_id || p.lesson_id] = {
        progress:     p.progress_percent || p.watch_percentage || 0,
        lastPosition: p.last_position || 0,
        completed:    p.completed || false,
        updatedAt:    p.updated_at || p.created_at || '',
      };
    }

    const allCourses: Course[] = (coursesRes.data || []).map((c: any) => ({
      ...c,
      progress:     progressMap[c.id]?.progress     || 0,
      lastPosition: progressMap[c.id]?.lastPosition || 0,
      completed:    progressMap[c.id]?.completed    || false,
      updatedAt:    progressMap[c.id]?.updatedAt    || '',
    }));

    setCourses(allCourses);

    // Group into sections by category, preserving sort_order
    const catMap: Record<string, Course[]> = {};
    for (const c of allCourses) {
      const cat = c.category || 'General';
      if (!catMap[cat]) catMap[cat] = [];
      catMap[cat].push(c);
    }
    const builtSections: Section[] = Object.entries(catMap).map(([category, cats]) => ({
      category,
      courses: cats,
      totalCompleted: cats.filter(c => c.completed).length,
    }));
    setSections(builtSections);
    // Open first section by default
    if (builtSections.length > 0) setOpenSection(builtSections[0].category);

    // Continue learning: most recently updated in-progress course
    const inProgress = allCourses
      .filter(c => c.progress > 0 && !c.completed && c.updatedAt)
      .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
    if (inProgress.length > 0) setContinueCourse(inProgress[0]);

    setLoading(false);
  }

  const saveProgress = useCallback(async (
    courseId: string, position: number, pct: number, completed?: boolean
  ) => {
    if (!userId) return;
    await supabase.from('user_progress').upsert({
      user_id:          userId,
      course_id:        courseId,
      progress_percent: Math.round(pct),
      last_position:    Math.round(position),
      ...(completed !== undefined ? { completed } : {}),
      updated_at:       new Date().toISOString(),
    }, { onConflict: 'user_id,course_id' });
  }, [userId]); // supabase is a stable ref — no need in deps

  function handleProgressUpdate(courseId: string, position: number, pct: number, completed?: boolean) {
    // Optimistic update local state
    setCourses(prev => prev.map(c => c.id === courseId ? {
      ...c,
      progress: Math.max(c.progress, pct),
      lastPosition: position,
      completed: completed !== undefined ? completed : c.completed,
    } : c));
    setSections(prev => prev.map(s => ({
      ...s,
      courses: s.courses.map(c => c.id === courseId ? {
        ...c,
        progress: Math.max(c.progress, pct),
        lastPosition: position,
        completed: completed !== undefined ? completed : c.completed,
      } : c),
      totalCompleted: s.courses.reduce((n, c) => {
        const isNowDone = c.id === courseId
          ? (completed !== undefined ? completed : c.completed)
          : c.completed;
        return n + (isNowDone ? 1 : 0);
      }, 0),
    })));
    saveProgress(courseId, position, pct, completed);
  }

  function handleToggleComplete(courseId: string, newCompleted: boolean) {
    handleProgressUpdate(courseId,
      courses.find(c => c.id === courseId)?.lastPosition || 0,
      courses.find(c => c.id === courseId)?.progress || 100,
      newCompleted
    );
    if (newCompleted) analytics.courseViewed?.(courseId);
  }

  const openCourse = (id: string) => {
    setActiveCourse(id);
    analytics.courseViewed(id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <SageLoader message="Loading courses…" />;
  if (hasAccess === false) return <UpgradePrompt feature="learn" />;

  const activeCourseData = activeCourse ? courses.find(c => c.id === activeCourse) : null;

  // ── Video player view ─────────────────────────────────────
  if (activeCourseData) {
    return (
      <VideoPlayer
        course={activeCourseData}
        onBack={() => setActiveCourse(null)}
        onProgressUpdate={handleProgressUpdate}
        onToggleComplete={handleToggleComplete}
      />
    );
  }

  // ── Course list view ──────────────────────────────────────
  const totalCourses    = courses.length;
  const totalCompleted  = courses.filter(c => c.completed).length;
  const overallPct      = totalCourses > 0 ? Math.round((totalCompleted / totalCourses) * 100) : 0;

  return (
    <div style={{ paddingTop: 8, paddingBottom: 40 }}>
      <style>{`
        @keyframes fade-in-up {
          from { opacity:0; transform:translateY(12px); }
          to   { opacity:1; transform:translateY(0); }
        }
      `}</style>

      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontFamily: B.fontDisplay, fontSize: 26, fontWeight: 700, color: B.dark200, margin: '0 0 2px' }}>
          Learn
        </h2>
        <p style={{ fontFamily: B.fontMono, fontSize: 10, color: B.dark400, margin: '0 0 14px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          Micro-courses from Africa's top leaders
        </p>

        {/* Overall progress bar */}
        {totalCourses > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1, height: 5, borderRadius: 3, background: B.dark600, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${overallPct}%`,
                background: `linear-gradient(90deg, ${B.goldDark}, ${B.gold})`,
                borderRadius: 3, transition: 'width 0.8s ease',
              }} />
            </div>
            <span style={{ fontFamily: B.fontMono, fontSize: 10, color: B.dark400, flexShrink: 0 }}>
              {totalCompleted}/{totalCourses} courses
            </span>
          </div>
        )}
      </div>

      {/* Continue Learning banner */}
      {continueCourse && (
        <ContinueBanner
          course={continueCourse}
          onResume={() => openCourse(continueCourse.id)}
        />
      )}

      {/* Sections */}
      {sections.length === 0 ? (
        <div style={{ textAlign: 'center', paddingTop: 60 }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📚</div>
          <p style={{ fontFamily: B.fontUI, fontSize: 13, color: B.dark400 }}>No courses yet — check back soon!</p>
        </div>
      ) : (
        sections.map((section) => (
          <SectionAccordion
            key={section.category}
            section={section}
            isOpen={openSection === section.category}
            onToggle={() => setOpenSection(
              openSection === section.category ? null : section.category
            )}
            onOpenCourse={openCourse}
          />
        ))
      )}
    </div>
  );
}
