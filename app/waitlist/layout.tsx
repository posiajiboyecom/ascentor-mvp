import type { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo';

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = generatePageMetadata({
  title: 'Join the Waitlist',
  description: 'Join the Ascentor waitlist: mentorship and leadership development for every stage of your journey, from finding your direction to leading at the top.',
  path: '/waitlist',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
