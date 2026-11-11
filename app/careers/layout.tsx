import type { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo';

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = generatePageMetadata({
  title: 'Careers',
  description: 'Join the small, remote-first team behind Ascentor and The Elevation Summit, democratising mentorship and leadership development. See open roles and apply.',
  path: '/careers',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
