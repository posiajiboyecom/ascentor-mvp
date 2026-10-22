import { redirect } from 'next/navigation';

// Alias: the invite link lives at /facilitator/<token>.
export default async function LeaderInviteAlias({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  redirect(`/facilitator/${encodeURIComponent(token)}`);
}
