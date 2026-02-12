'use client';

import { useState } from 'react';

const COURSES = [
  { id: 1, title: 'The GROW Model for Coaching Conversations', category: 'Frameworks', difficulty: 'beginner', lessons: 5, duration: '25 min', progress: 80, emoji: '🌱' },
  { id: 2, title: 'Navigating Hierarchical Cultures', category: 'African Context', difficulty: 'intermediate', lessons: 4, duration: '20 min', progress: 45, emoji: '🏛️' },
  { id: 3, title: 'The Art of Strategic Visibility', category: 'Career Growth', difficulty: 'intermediate', lessons: 6, duration: '30 min', progress: 0, emoji: '🔭' },
  { id: 4, title: 'Difficult Conversations Toolkit', category: 'Communication', difficulty: 'advanced', lessons: 8, duration: '40 min', progress: 20, emoji: '💬' },
  { id: 5, title: 'Building Your Personal Board of Advisors', category: 'Networking', difficulty: 'beginner', lessons: 3, duration: '15 min', progress: 100, emoji: '🤝' },
  { id: 6, title: 'Leading Without Authority', category: 'Leadership', difficulty: 'intermediate', lessons: 5, duration: '25 min', progress: 0, emoji: '🧭' },
];

const CATEGORIES = ['All', 'Frameworks', 'African Context', 'Career Growth', 'Communication', 'Networking', 'Leadership'];

export default function LearnPage() {
  const [filter, setFilter] = useState('All');

  const filtered = filter === 'All' ? COURSES : COURSES.filter((c) => c.category === filter);

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
      <div className="flex gap-1.5 overflow-x-auto mb-5 pb-1 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
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
        {filtered.map((course, i) => (
          <div key={course.id}
            className="rounded-xl p-5 animate-fade-up"
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
                  {course.progress === 100 && (
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

                {course.progress > 0 && course.progress < 100 && (
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-input)' }}>
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${course.progress}%`, background: 'var(--accent)' }} />
                  </div>
                )}
                {course.progress === 0 && (
                  <button className="px-3.5 py-1.5 rounded-lg text-xs font-semibold"
                    style={{ border: '1px solid var(--border)', color: 'var(--text)' }}>
                    Start Course
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
