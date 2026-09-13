'use client';

import PublicHeader from '@/components/layout/PublicHeader';
import PublicFooter from '@/components/layout/PublicFooter';

type PublicShellProps = {
  children: React.ReactNode;
  hasBlogPosts?: boolean;
};

export default function PublicShell({ children, hasBlogPosts = false }: PublicShellProps) {
  return (
    <>
      <PublicHeader hasBlogPosts={hasBlogPosts} />
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <PublicFooter hasBlogPosts={hasBlogPosts} />
    </>
  );
}
