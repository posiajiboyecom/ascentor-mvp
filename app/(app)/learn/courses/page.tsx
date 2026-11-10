// app/(app)/learn/courses/page.tsx
// The old course catalogue has been retired; every lesson now lives on the Learn pathway.
import { redirect } from 'next/navigation';

export default function OldCourseCatalogue() {
  redirect('/learn');
}
