// app/admin/courses/page.tsx
// The old course catalogue editor has been retired. Lessons are managed in the console:
// Learn → Pathways and lessons.
import { redirect } from 'next/navigation';

export default function OldAdminCourses() {
  redirect('/admin/c/pathways');
}
