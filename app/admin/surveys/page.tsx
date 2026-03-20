// app/admin/surveys/page.tsx
import { Suspense } from 'react';
import AdminSurveysInner from './AdminSurveysInner';

export default function AdminSurveysPage() {
  return (
    <Suspense fallback={
      <div style={{ padding: '60px 0', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Loading surveys...</p>
      </div>
    }>
      <AdminSurveysInner />
    </Suspense>
  );
}
