import '@/styles/rx.css';
import { ToastProvider } from '@/components/rx/Toast';
import { requireAdmin } from '@/lib/rx/admin';
import { supabaseAdmin } from '@/lib/supabase/admin';
import LessonVideosAdmin, { type AdminLesson } from '@/components/rx/admin/LessonVideosAdmin';
import { Title } from '@/components/rx/ui';

export const dynamic = 'force-dynamic';

export default async function AdminLessonVideosPage() {
  try { await requireAdmin(); } catch { return <div className="rx rx-page"><div className="rx-card rx-empty"><p className="rx-p">Lesson videos are managed by admins.</p></div></div>; }
  const { data } = await supabaseAdmin.from('rx_lessons').select('id, slug, title, dimension, format, video_url, sort').order('sort');
  const lessons = (data ?? []) as AdminLesson[];
  return (
    <ToastProvider>
      <div className="rx" style={{ padding: 16 }}>
        <p className="rx-sm">Learn</p>
        <Title>Lesson videos</Title>
        <p className="rx-p" style={{ maxWidth: 640, margin: '8px 0 16px' }}>
          Paste a YouTube link for each lesson: a watch, youtu.be, embed or shorts link all work. Members see it in the lesson player and their progress is saved as they watch.
        </p>
        <LessonVideosAdmin lessons={lessons} />
      </div>
    </ToastProvider>
  );
}
