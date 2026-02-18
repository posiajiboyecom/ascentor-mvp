'use client';

import { Suspense } from 'react';
import AdminBlogPageInner from './BlogInner';

export default function AdminBlogPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Loading...</p></div>}>
      <AdminBlogPageInner />
    </Suspense>
  );
}