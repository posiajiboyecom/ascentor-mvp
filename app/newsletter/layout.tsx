import type { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo';

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = generatePageMetadata({
  title: 'The Ascentor Weekly Newsletter',
  description: 'Every Tuesday: one actionable leadership insight, one framework you can use immediately, and one story from a leader who has been where you are. Free.',
  path: '/newsletter',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
