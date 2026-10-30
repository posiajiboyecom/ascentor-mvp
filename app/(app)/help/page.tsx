import { SUPPORT_EMAIL } from '@/lib/contact';
import { redirect } from 'next/navigation';
import { getMe } from '@/lib/rx/server';
import { Aside, GoLink, Page, Title } from '@/components/rx/ui';
import { HelpMain } from '@/components/rx/pages/HelpClient';
import '@/styles/rx-pages.css';

export const dynamic = 'force-dynamic';

export default async function HelpPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  return (
    <Page>
      <Title>Help</Title>
      <div className="rx-two">
        <HelpMain name={me.fullName} email={me.email} />
        <Aside>
          <p className="rx-label">Email</p>
          <p className="rx-p">{SUPPORT_EMAIL} · we reply within 2 to 3 business days.</p>
          <p className="rx-label">In danger?</p>
          <p className="rx-p">Call 112, Nigeria’s emergency number.</p>
          <p className="rx-label">Guides</p>
          <div><GoLink href="/sage/memory">What Sage knows</GoLink></div>
          <div><GoLink href="/terms">Community guidelines</GoLink></div>
        </Aside>
      </div>
    </Page>
  );
}
