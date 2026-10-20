import { Suspense } from 'react';
import type { Metadata } from 'next';
import Recovery from '@/components/auth/Recovery';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false, follow: false } };

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <Recovery mode="forgot" />
    </Suspense>
  );
}
