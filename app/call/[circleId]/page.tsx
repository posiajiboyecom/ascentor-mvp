import { notFound, redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import CallScreen from '@/components/rx/call/CallScreen';

export const dynamic = 'force-dynamic';

export default async function CirclePhoneCall({ params }: { params: Promise<{ circleId: string }> }) {
  const { circleId } = await params;
  const me = await getMe();
  if (!me) redirect('/login');
  if (!/^[0-9a-f-]{36}$/i.test(circleId)) notFound();
  return <CallScreen circleId={circleId} kind="circle" backHref="/circle" firstName={me.firstName} />;
}
