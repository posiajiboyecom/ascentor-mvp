import { Suspense } from 'react';
import type { Metadata } from 'next';
import Recovery from '@/components/auth/Recovery';

// The link carries a one-time code in its query string: keep it out of Referer headers and search indexes.
export const metadata: Metadata = {
  title: 'Set a new password',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <Recovery mode="reset" />
    </Suspense>
  );
}
