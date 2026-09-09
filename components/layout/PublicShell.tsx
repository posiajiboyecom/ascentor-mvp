'use client';

import PublicHeader from '@/components/layout/PublicHeader';
import PublicFooter from '@/components/layout/PublicFooter';

type PublicShellProps = {
  children: React.ReactNode;
  events?: Array<{ slug: string; title: string; tagline: string | null; event_date: string | null }>;
  hasBlogPosts?: boolean;
};

export default function PublicShell({ children, events = [], hasBlogPosts = false }: PublicShellProps) {
  return (
    <>
      <PublicHeader events={events} hasBlogPosts={hasBlogPosts} />
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <PublicFooter hasBlogPosts={hasBlogPosts} />
    </>
  );
}
