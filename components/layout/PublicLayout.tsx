'use client';

import { usePathname } from 'next/navigation';
import PublicHeader from '@/components/layout/PublicHeader';
import PublicFooter from '@/components/layout/PublicFooter';

const PUBLIC_PATHS = [
  '/who-its-for',
  '/mentor-apply',
  '/waitlist',
  '/manifesto',
  '/careers',
  '/terms',
  '/contact',
  '/about',
  '/offline',
  '/checkout',
  '/how-it-works',
  '/newsletter',
  '/products',
  '/privacy',
  '/partner-apply',
  '/blog',
  '/movement',
  '/elevation-summit',
  '/nav/learn',
  '/nav/experts',
  '/nav/community',
  '/nav/coach',
];

const PUBLIC_PREFIXES = [
  '/blog/',
  '/survey/',
  '/products/',
  '/p/', // partner subdomains are public-facing
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.includes(pathname)) return true;
  if (PUBLIC_PREFIXES.some(prefix => pathname.startsWith(prefix))) return true;
  return false;
}

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicPath = isPublicPath(pathname);

  return (
    <>
      {publicPath && <PublicHeader />}
      <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      {publicPath && <PublicFooter />}
    </>
  );
}
