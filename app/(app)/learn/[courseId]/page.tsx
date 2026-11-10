// app/(app)/learn/[courseId]/page.tsx
// Old course pages have been retired; every lesson now lives on the Learn pathway.
import { redirect } from 'next/navigation';

export default function OldCoursePage() {
  redirect('/learn');
}
