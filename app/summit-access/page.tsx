// /summit-access: Elevation Summit attendees claim Ascentor Builder free for 12 months (components/auth/SummitAccess.tsx).
import { Suspense } from 'react';
import type { Metadata } from 'next';
import SummitAccess from '@/components/auth/SummitAccess';

export const metadata: Metadata = { title: 'Claim your free year', robots: { index: false, follow: false } };

export default function SummitAccessPage() {
  return (
    <Suspense>
      <SummitAccess />
    </Suspense>
  );
}
