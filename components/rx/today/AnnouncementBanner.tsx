import NoticeCard from '@/components/rx/NoticeCard';

/** The banner at the top of Today. The same card as everywhere else, and members cannot dismiss it. */
export default function AnnouncementBanner({ id, title, line, btn }: { id: string; title: string; line: string; btn: string }) {
  return <NoticeCard notice={{ id: `announcement:${id}`, source: 'announcement', title, line, href: `/announcements?focus=${id}`, actionLabel: btn }} />;
}
