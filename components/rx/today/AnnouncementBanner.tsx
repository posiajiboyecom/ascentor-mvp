'use client';

import NoticeCard from '@/components/rx/NoticeCard';
import { useToast } from '@/components/rx/Toast';

/** The banner at the top of Today. The same card as the sidebar's. Dismissing it only hides it here. */
export default function AnnouncementBanner({ id, title, line, btn }: { id: string; title: string; line: string; btn: string }) {
  const toast = useToast();
  return (
    <NoticeCard
      notice={{ id: `announcement:${id}`, source: 'announcement', title, line, href: `/announcements?focus=${id}`, actionLabel: btn }}
      storageKey={`rx:ann-hidden:${id}`}
      onDismiss={() => toast('Hidden from Today. It’s still in your menu.')}
    />
  );
}
