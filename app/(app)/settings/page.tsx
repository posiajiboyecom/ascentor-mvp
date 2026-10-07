import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Download, Globe } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getMe, namesFor } from '@/lib/rx/server';
import { Aside, BackLink, GoLink, Page, Title } from '@/components/rx/ui';
import { LanguageSelect, MessagingCard, NotificationsCard, ResearchToggle, TimezoneSelect } from '@/components/rx/settings/SettingsClient';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const me = await getMe();
  if (!me) redirect('/login');
  const db = await createClient();
  const { data: blockRows } = await db.from('dm_blocks').select('blocked_id').eq('blocker_id', me.userId);
  const blockedIds = ((blockRows ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id);
  const blockedNames = blockedIds.length ? await namesFor(db, blockedIds) : new Map();
  const blocked = blockedIds.map((id) => ({ id, name: (blockedNames.get(id) as { name: string } | undefined)?.name ?? 'Member' }));
  const p = me.profile;

  return (
    <Page>
      <BackLink href="/profile">Profile</BackLink>
      <Title>Settings</Title>
      <div className="rx-two">
        <div className="rx-stack-lg">
          <NotificationsCard notif={p?.notif ?? {}} annMuted={p?.ann_muted ?? false} quiet={p?.quiet_hours ?? true} />
          <MessagingCard policy={p?.dm_policy ?? 'circle_and_requests'} blocked={blocked} />
          <div className="rx-card rx-stack">
            <p className="rx-label">Privacy and data</p>
            <ResearchToggle on={p?.research_opt_in ?? false} />
            <div className="rx-row">
              <a href="/api/rx/export" className="rx-btn secondary" download><Download aria-hidden style={{ width: 16, height: 16 }} />Export my data</a>
              <Link href="/account" className="rx-link">Delete account</Link>
            </div>
          </div>
        </div>
        <Aside>
          <p className="rx-label">Sage</p>
          <GoLink href="/sage/memory">What Sage knows</GoLink>
          <GoLink href="/sage/reminders">Reminder settings</GoLink>
          <p className="rx-label">Time zone</p>
          <TimezoneSelect label={p?.timezone_label ?? p?.timezone ?? ''} />
          <p className="rx-label">Language</p>
          <LanguageSelect value={p?.language ?? 'English'} />
          <p className="rx-label">Account</p>
          <GoLink href="/account">Name, email, sign-in and billing</GoLink>
          <p className="rx-label">Ascentor</p>
          <p className="rx-row rx-nw rx-sm" style={{ gap: 8 }}><Globe aria-hidden style={{ width: 16, height: 16 }} />www.joinascentor.com</p>
          <p className="rx-sm">Instagram: <a className="rx-link" style={{ minHeight: 0, fontSize: 14 }} href="https://instagram.com/joinascentor" target="_blank" rel="noopener noreferrer">joinascentor</a></p>
          <p className="rx-sm">X: <a className="rx-link" style={{ minHeight: 0, fontSize: 14 }} href="https://x.com/joinascentor" target="_blank" rel="noopener noreferrer">joinascentor</a></p>
        </Aside>
      </div>
    </Page>
  );
}
