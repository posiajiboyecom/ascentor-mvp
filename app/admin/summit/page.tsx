// app/admin/summit/page.tsx
// Retired: Elevation Summit registrations now live in exactly one place,
// /admin/elevation-summit/registrations. This route used to render a
// second, older registrations table (SummitAdminClient.tsx) that duplicated
// most of that page and confused which one was "the" Summit registrations
// page. Redirect old links/bookmarks straight there instead of 404ing.
import { redirect } from 'next/navigation';

export default function AdminSummitPage() {
  redirect('/admin/elevation-summit/registrations');
}
