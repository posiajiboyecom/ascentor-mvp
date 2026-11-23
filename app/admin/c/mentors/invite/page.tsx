import MentorInvitesScreen from '@/components/admin/console/MentorInvitesScreen';
import { requireArea } from '@/lib/admin/access';
import { listMentorInvites, MENTOR_SETUP_MESSAGE } from '@/lib/mentor-invites';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Invite a mentor' };

export default async function MentorInvitePage() {
  await requireArea('mentors', 'edit');
  const { rows, setup } = await listMentorInvites();
  return <MentorInvitesScreen rows={rows} setupMessage={setup ? MENTOR_SETUP_MESSAGE : ''} />;
}
