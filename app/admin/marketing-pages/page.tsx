'use client';

// app/admin/marketing-pages/page.tsx — THE LEDGER
// List of all CMS-managed marketing pages with section/draft counts.
// Click through to /admin/marketing-pages/[slug] to edit.

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface PageRow {
  id: string;
  slug: string;
  title: string;
  route: string;
  status: 'draft' | 'published';
  description: string | null;
  updated_at: string;
  sectionCounts: { published: number; draft: number };
}

export default function MarketingPagesListPage() {
  const supabase = createClient();
  const [pages, setPages] = useState<PageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin/marketing-cms', {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load pages');
      setPages(data.pages || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <span className="ledger-eyebrow">Content · Marketing CMS</span>
        <h1 className="ledger-h1" style={{ fontSize: 28, marginTop: 6 }}>Marketing Pages</h1>
        <p className="ledger-mono" style={{ marginTop: 6 }}>
          Manage the landing page and 6 marketing pages — draft content, then publish when ready.
        </p>
      </div>

      {error && (
        <div className="ledger-tag ledger-tag-flag" style={{ display: 'block', padding: '10px 14px', marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="ledger-panel" style={{ padding: 40, textAlign: 'center' }}>
          <p className="ledger-mono">Loading pages…</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {pages.map(page => {
            const total = page.sectionCounts.published + page.sectionCounts.draft;
            const allPublished = total > 0 && page.sectionCounts.draft === 0;
            const hasUnpublished = page.sectionCounts.draft > 0;

            return (
              <Link key={page.slug} href={`/admin/marketing-pages/${page.slug}`} style={{ textDecoration: 'none' }}>
                <div className="ledger-panel" style={{
                  padding: '18px 22px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 16,
                  cursor: 'pointer',
                  transition: 'border-color 0.12s',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <h2 className="ledger-h2" style={{ fontSize: 17 }}>{page.title}</h2>
                      <span className="ledger-mono" style={{ fontSize: 10.5 }}>{page.route}</span>
                    </div>
                    {page.description && (
                      <p className="ledger-mono" style={{ fontSize: 11.5, opacity: 0.8, maxWidth: 520 }}>
                        {page.description}
                      </p>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {total === 0 ? (
                      <span className="ledger-tag" style={{ background: 'var(--ledger-bg-input)', color: 'var(--ledger-ink-faint)' }}>
                        Not started
                      </span>
                    ) : (
                      <>
                        {hasUnpublished && (
                          <span className="ledger-tag ledger-tag-new">
                            {page.sectionCounts.draft} draft{page.sectionCounts.draft === 1 ? '' : 's'}
                          </span>
                        )}
                        {page.sectionCounts.published > 0 && (
                          <span className="ledger-tag ledger-tag-ok">
                            {page.sectionCounts.published} live
                          </span>
                        )}
                      </>
                    )}
                    <span style={{ color: 'var(--ledger-ink-faint)', fontSize: 14 }}>→</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
