'use client';

import { Suspense } from 'react';
import AdminContentPage from './ContentInner';

export default function AdminContent() {
  return (
    <Suspense fallback={
      <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: "Metropolis, 'Inter', sans-serif", fontSize: 10, color: '#4A4438', letterSpacing: '0.1em' }}>
        Loading pipeline...
      </div>
    }>
      <AdminContentPage />
    </Suspense>
  );
}
