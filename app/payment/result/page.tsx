import Link from 'next/link';
import { Check } from 'lucide-react';
import { PLAN_PRICING_MAP } from '@/lib/pricing';
import '@/styles/rx.css';
import '@/styles/rx-entry.css';

export const metadata = { title: 'Payment' };
export const dynamic = 'force-dynamic';

type Sp = { status?: string; kind?: string; order?: string; plan?: string; billing?: string };

const naira = (n: number) => `₦${n.toLocaleString('en-NG')}`;

export default async function PaymentResultPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const sp = await searchParams;
  const status = sp.status === 'success' || sp.status === 'processing' ? sp.status : 'failed';
  const isOrder = sp.kind === 'order';
  const ok = status === 'success';
  const processing = status === 'processing';
  const plan = sp.plan ? PLAN_PRICING_MAP[sp.plan] : undefined;
  const yearly = sp.billing === 'annual';
  const price = plan ? (yearly ? `${naira(plan.yearlyPrice)} a year` : `${naira(plan.monthlyPrice)} a month`) : null;
  const orderNo = sp.order ? sp.order.slice(0, 8).toUpperCase() : null;

  let title = 'Payment didn’t go through';
  let sub = '';
  if (processing) {
    title = 'Payment is processing';
    sub = 'Your bank is still confirming. We’ll switch your access on as soon as it clears. You don’t need to pay again.';
  } else if (ok) {
    title = isOrder ? 'Order confirmed' : plan ? `You’re on ${plan.name}` : 'Payment received';
    sub = isOrder ? 'Thank you. We’re packing your order now.' : 'Your payment went through. Full access is back on.';
  } else {
    sub = isOrder
      ? 'Your bank didn’t approve the payment, so nothing was charged. Your cart is saved.'
      : 'Your bank didn’t approve the payment. You keep your current access while you try again.';
  }

  const retryHref = isOrder ? '/store/cart' : '/checkout';
  const primary = ok
    ? (isOrder ? { href: '/store/orders', label: 'View my orders' } : { href: '/dashboard', label: 'Back to Today' })
    : processing
      ? { href: '/dashboard', label: 'Back to Today' }
      : { href: retryHref, label: 'Try again' };
  const secondary = ok
    ? (isOrder ? { href: '/store', label: 'Keep shopping' } : { href: '/settings', label: 'See my plan' })
    : processing ? null : { href: retryHref, label: 'Use a different card' };

  const asideT = ok ? 'Receipt' : processing ? 'Still waiting' : 'Nothing was charged';
  const asideP = ok
    ? 'We’ve emailed a receipt to the address on your account.'
    : processing
      ? 'Bank transfers and some cards take a few minutes. Check back shortly.'
      : 'If you see a pending charge, your bank will reverse it within a few days.';

  return (
    <div className="rx rx-entry rx-entry-wide">
      <div className="rx-entry-in rx-rise">
        <Link href="/" className="rx-entry-logo"><img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" /></Link>
        <div className="rx-entry-two">
          <div className="rx-stack-lg">
            <div className="rx-stack-sm">
              {ok ? <span className="rx-okbadge"><Check aria-hidden /></span> : <span className="rx-failbadge">!</span>}
              <h1 className="rx-title" style={{ marginTop: 10 }}>{title}</h1>
              <span className="rx-rule" style={{ margin: '6px 0 10px' }} />
              <p className="rx-p" style={{ fontSize: 17 }}>{sub}</p>
            </div>

            {status === 'failed' && (
              <div className="rx-card rx-stack-sm">
                <p className="rx-label">Common reasons</p>
                <p className="rx-p">Not enough funds, or your bank blocked an online payment.</p>
                <p className="rx-p">The card has expired.</p>
                <p className="rx-p">The one-time code from your bank timed out.</p>
              </div>
            )}

            {ok && isOrder && (
              <div className="rx-card rx-stack">
                <div className="rx-between"><p className="rx-label">Order{orderNo ? ` ${orderNo}` : ''}</p><span className="rx-tag gold">Paid</span></div>
                <p className="rx-sm">Items and delivery are listed under My orders.</p>
              </div>
            )}
            {ok && !isOrder && plan && (
              <div className="rx-card rx-stack-sm">
                <div className="rx-between"><p className="rx-label">{plan.name}</p><span className="rx-tag gold">Active</span></div>
                <p className="rx-p">{price}</p>
                <p className="rx-sm">Paid via Paystack</p>
              </div>
            )}

            <div className="rx-row">
              <Link href={primary.href} className="rx-btn primary">{primary.label}</Link>
              {secondary && <Link href={secondary.href} className="rx-btn secondary">{secondary.label}</Link>}
            </div>
          </div>
          <aside className="rx-aside rx-card">
            <p className="rx-label">{asideT}</p>
            <p className="rx-p">{asideP}</p>
            <p className="rx-label">Need help?</p>
            <div><Link href="/contact" className="rx-link">Help centre</Link></div>
          </aside>
        </div>
      </div>
    </div>
  );
}
