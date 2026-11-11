import type { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo';

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = generatePageMetadata({
  title: 'Contact',
  description: 'Contact the Ascentor team about partnerships, The Elevation Summit, speaking, or the platform. We read every message.',
  path: '/contact',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
