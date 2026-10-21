import type { Metadata } from 'next';
import Link from 'next/link';
import PublicShell from '@/components/layout/PublicShell';
import ShopStyles from '@/components/shop/ShopStyles';
import ClearCart from '@/components/shop/ClearCart';

export const metadata: Metadata = {
  title: 'Thank you | Shop',
  description: 'Your Ascentor shop order.',
  robots: { index: false },
};

export default async function ThanksPage({ searchParams }: { searchParams: Promise<{ paid?: string; order?: string }> }) {
  const { paid, order } = await searchParams;
  const processing = paid === 'processing';
  return (
    <PublicShell>
      <ShopStyles />
      <ClearCart />
      <div className="sp">
        <div className="sp-wrap" style={{ maxWidth: 640, textAlign: 'center', padding: '5rem 1.5rem' }}>
          <div className="sp-eyebrow">{processing ? 'Payment processing' : 'Order confirmed'}</div>
          <h1>{processing ? 'We are confirming your payment.' : 'Thank you.'}</h1>
          <p className="sp-sub" style={{ margin: '1rem auto 2rem' }}>
            {processing
              ? 'This usually takes a minute. A receipt will be emailed to you as soon as it clears.'
              : 'Your payment was received. A confirmation, and any download links, are on their way to your email.'}
          </p>
          {order && <p style={{ fontSize: '.8rem', color: '#6B7280' }}>Order reference: {order}</p>}
          <Link href="/shop" className="sp-btn rust">Continue shopping</Link>
        </div>
      </div>
    </PublicShell>
  );
}
