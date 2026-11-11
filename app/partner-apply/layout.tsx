import type { Metadata } from 'next';
import { generatePageMetadata } from '@/lib/seo';

// The page itself is a client component, so its metadata lives here.
export const metadata: Metadata = generatePageMetadata({
  title: 'Launch Your Coaching Platform',
  description: 'Apply for your own branded coaching platform with your logo, colours and domain, powered by Ascentor’s AI and community infrastructure.',
  path: '/partner-apply',
});

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
