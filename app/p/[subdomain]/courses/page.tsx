// ============================================================
// app/p/[subdomain]/courses/page.tsx
// Partner member — browse and watch courses published by the coach
// ============================================================

'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Course {
  id: string;
  title: string;
  description: string | null;
  youtube_id: string;
  thumbnail_url: string | null;
  category: string | null;
  difficulty: string | null;
  duration: string | null;
  access_tier: string | null;
  sort_order: number;
}

const DIFF_COLOR: Record<string, string> = {
  beginner:     '#14B8A6',
  intermediate: '#E8A020',
  advanced:     '#8B5CF6',
};

export default function PartnerCoursesPage() {
  const supabase = createClient();
  const [courses, setCourses]   = useState<Course[]>([]);
  const [loading, setLoading]   = useState(true);
  const [playing, setPlaying]   = useState<string | null>(null);
  const [partnerId, setPartnerId] = useState<string | null>(null);

  useEffect(() => {
    const subdomain = window.location.pathname.split('/')[2];
    supabase.from('partners').select('id').eq('subdomain', subdomain).single()
      .then(async ({ data }) => {
        if (!data) { setLoading(false); return; }
        setPartnerId(data.id);
        const { data: c } = await supabase
          .from('partner_courses')
          .select('*')
          .eq('partner_id', data.id)
          .eq('is_published', true)
          .order('sort_order', { ascending: true });
        setCourses(c || []);
        setLoading(false);
      });
  }, []);

  if (loading) return (
    <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-dim)', fontSize: 13 }}>
      Loading courses...
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '0 0 40px' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--font-heading)', fontSize: 26, color: 'var(--text)', marginBottom: 4 }}>
          Learn
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
          {courses.length} course{courses.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {courses.length === 0 ? (
        <div style={{
          padding: '40px 24px', textAlign: 'center',
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
        }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            No courses yet
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Your coach hasn't published any courses yet. Check back soon.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {courses.map(course => (
            <div key={course.id} style={{
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              borderRadius: 14, overflow: 'hidden',
            }}>
              {/* Video player */}
              {playing === course.id ? (
                <div style={{ position: 'relative', aspectRatio: '16/9', background: '#000' }}>
                  <iframe
                    src={`https://www.youtube.com/embed/${course.youtube_id}?autoplay=1&rel=0`}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
              ) : (
                /* Thumbnail / play button */
                <div
                  onClick={() => setPlaying(course.id)}
                  style={{
                    position: 'relative', aspectRatio: '16/9',
                    background: '#000', cursor: 'pointer', overflow: 'hidden',
                  }}
                >
                  <img
                    src={course.thumbnail_url || `https://img.youtube.com/vi/${course.youtube_id}/maxresdefault.jpg`}
                    alt={course.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }}
                  />
                  {/* Play button overlay */}
                  <div style={{
                    position: 'absolute', inset: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.75)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'transform 0.15s',
                    }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <polygon points="5,3 19,12 5,21" />
                      </svg>
                    </div>
                  </div>
                </div>
              )}

              {/* Info */}
              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 6 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', lineHeight: 1.4 }}>
                    {course.title}
                  </p>
                  {playing === course.id && (
                    <button onClick={() => setPlaying(null)}
                      style={{
                        fontSize: 10, padding: '3px 8px', borderRadius: 6,
                        border: '1px solid var(--border)', background: 'transparent',
                        color: 'var(--text-dim)', cursor: 'pointer', flexShrink: 0,
                      }}>
                      Close
                    </button>
                  )}
                </div>
                {course.description && (
                  <p style={{ fontSize: 12, color: 'var(--text-dim)', lineHeight: 1.6, marginBottom: 8 }}>
                    {course.description}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  {course.category && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600,
                      textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      {course.category}
                    </span>
                  )}
                  {course.difficulty && (
                    <span style={{
                      fontSize: 10, fontWeight: 700,
                      color: DIFF_COLOR[course.difficulty] || 'var(--text-dim)',
                    }}>
                      {course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1)}
                    </span>
                  )}
                  {course.duration && (
                    <span style={{ fontSize: 10, color: 'var(--text-dim)' }}>{course.duration}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
