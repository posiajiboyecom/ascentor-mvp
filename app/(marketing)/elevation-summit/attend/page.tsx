// /elevation-summit/attend - "I will be attending" flyer maker. Public: no account needed. Everything runs in the browser;
// a photo never leaves the visitor's device.
import type { Metadata } from 'next';
import PublicShell from '@/components/layout/PublicShell';
import { SITE_URL } from '@/lib/seo';
import AttendClient from './AttendClient';

export const metadata: Metadata = {
  title: 'I will be attending | The Elevation Summit 2026',
  description: 'Make your own "I will be attending" flyer for The Elevation Summit, 19 November 2026 in Lagos. Add your name and photo, download it as a PNG and share it.',
  robots: { index: false, follow: false }, // reached from the registration success screens, not from search or the footer
  alternates: { canonical: `${SITE_URL}/elevation-summit/attend` },
  openGraph: {
    title: 'I will be attending The Elevation Summit 2026',
    description: 'Make your own flyer, download it and share it.',
    url: `${SITE_URL}/elevation-summit/attend`,
    siteName: 'Ascentor',
    type: 'website',
    images: [{ url: `${SITE_URL}/images/elevation-summit-flyer-v3.jpg` }],
  },
};

export default function AttendPage() {
  return (
    <PublicShell>
      <AttendClient />
    </PublicShell>
  );
}
