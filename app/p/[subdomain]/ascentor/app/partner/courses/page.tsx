// app/partner/courses/page.tsx
export const dynamic = 'force-dynamic';

import { createClient } from '@/lib/supabase/server';
import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Courses' };

export default async function PartnerCoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // FIX: was querying dead `tenants` table. Migrated to `partners`.
  // courses.tenant_id is also an old schema field — courses are now global
  // content managed by the Ascentor admin; partners enable/disable them via
  // their features.courses flag. This page shows all published courses.
  const { data: partner } = await supabase
    .from('partners')
    .select('id, features')
    .eq('owner_id', user.id)
    .single();

  const coursesEnabled = (partner as any)?.features?.courses !== false;

  const { data: courses } = coursesEnabled
    ? await supabase
        .from('courses')
        .select('id, title, description, is_published, created_at')
        .order('created_at', { ascending: false })
    : { data: [] };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 500, color: '#f8fafc', marginBottom: '4px' }}>Courses</h1>
          <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)' }}>
            Learning content available on your platform.
          </p>
        </div>
      </div>

      {!courses || courses.length === 0 ? (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)', borderRadius: '10px', padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginBottom: '6px' }}>No courses yet</p>
          <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>
            Courses are managed by the Ascentor admin team. Contact support to add content.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {courses.map((course: any) => (
            <div key={course.id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: '#f8fafc', fontSize: '14px', fontWeight: 500, marginBottom: '3px' }}>{course.title}</p>
                {course.description && (
                  <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>{course.description}</p>
                )}
              </div>
              <span style={{
                padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 500,
                background: course.is_published ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)',
                color: course.is_published ? '#4ade80' : 'rgba(255,255,255,0.4)',
                border: `1px solid ${course.is_published ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.1)'}`,
              }}>
                {course.is_published ? 'Published' : 'Draft'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
