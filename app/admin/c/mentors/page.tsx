// /admin/c/mentors. The folder exists for the mentor links sub-page (mentors/invite), which would otherwise shadow the generic
// [area] page for this URL, so this renders the same generic list screen for the Mentors area.
import AreaPage from '../[area]/page';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const metadata = { title: 'Mentors' };

export default function MentorsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  return AreaPage({ params: Promise.resolve({ area: 'mentors' }), searchParams });
}
