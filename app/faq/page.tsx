import '@/styles/marketing.css';
import PublicShell from '@/components/layout/PublicShell';
import { FAQ, faqSchema } from '@/lib/faq';
import { pageMeta } from '@/lib/seo';

export const metadata = pageMeta({
  title: 'Frequently Asked Questions',
  description:
    'Answers about Ascentor: what it is, who it is for, what a Circle and Sage are, who the mentors are, and how it differs from a networking group.',
  path: '/faq',
});

export default function FaqPage() {
  return (
    <PublicShell>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema()).replace(/</g, '\\u003c') }} />
      <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', maxWidth: '820px', margin: '0 auto', width: '100%' }}>
        <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>FAQ</p>
        <h1 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '2.5rem' }}>Frequently asked questions</h1>
        <div>
          {FAQ.map(({ q, a }) => (
            // details/summary: every answer is in the HTML, collapsed until opened.
            <details key={q} style={{ borderBottom: '1px solid #E8E6E1' }}>
              <summary style={{ cursor: 'pointer', padding: '1.25rem 0', fontWeight: 600, color: '#0F0F0E', fontSize: '1.0625rem', minHeight: 44, listStylePosition: 'outside' }}>{q}</summary>
              <p style={{ fontSize: '1rem', color: '#374151', lineHeight: 1.75, paddingBottom: '1.25rem', margin: 0 }}>{a}</p>
            </details>
          ))}
        </div>
      </section>
    </PublicShell>
  );
}
