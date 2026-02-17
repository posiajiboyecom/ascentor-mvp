import type { Metadata } from 'next';
import LandingClient from './LandingClient';

export const metadata: Metadata = {
  title: 'Ascentor — AI Leadership Coach for African Professionals',
  description: 'Affordable, culturally intelligent AI coaching, live expert sessions, and peer accountability for Africa\'s next generation of leaders. Start for $15/month.',
  keywords: ['leadership coaching Africa', 'AI career coach', 'African professionals', 'executive coaching affordable', 'leadership development Nigeria', 'peer accountability', 'career growth Africa'],
  openGraph: {
    title: 'Ascentor — AI Leadership Coach for African Professionals',
    description: 'AI coaching + expert sessions + peer cohorts. Leadership development built for Africa\'s next generation. $15/month.',
    type: 'website',
    url: 'https://ascentor.co',
    siteName: 'Ascentor',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ascentor — AI Leadership Coach for African Professionals',
    description: 'AI coaching + expert sessions + peer cohorts. Leadership development built for Africa.',
  },
  robots: { index: true, follow: true },
  alternates: { canonical: 'https://ascentor.co' },
};

export default function LandingPage() {
  return <LandingClient />;
}
