// /admin/c/members. The folder exists for the Leader invites sub-page (members/leaders), which would otherwise shadow the generic
// [area] page for this URL, so this renders the same generic list screen for the Members area.
import AreaPage from '../[area]/page';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;
export const metadata = { title: 'Members' };

export default function MembersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  return AreaPage({ params: Promise.resolve({ area: 'members' }), searchParams });
}
