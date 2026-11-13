'use client';

// Public donate page for Ascentor / The Elevation Summit. Same brand
// language as the Elevation Summit page (gold/black, Metropolis, the shared
// mkt-* classes) and the same payment machinery: Paystack popup ->
// /api/donate/initiate -> /api/donate/verify, settled by the same
// lib/paymentSettlement.ts used for Summit tickets and subscriptions.
import { useEffect, useRef, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { donateFormSchemaFor, DONATION_LIMITS, type DonateFormValues, type DonationCurrency } from './donateFormSchema';
import { useModal } from '@/components/Modal';
import { useRouter } from 'next/navigation';
import { Check, HeartHandshake } from 'lucide-react';
import 'react-phone-number-input/style.css';
import PhoneInput from 'react-phone-number-input';
import flags from 'react-phone-number-input/flags';
import '@/styles/marketing.css';


const INPUT = {
  display: 'block' as const,
  width: '100%',
  padding: '0.75rem 1rem',
  fontSize: '0.9375rem',
  borderRadius: '0.625rem',
  border: '1.5px solid #E8E6E1',
  background: '#FAFAF8',
  color: '#0F0F0E',
  outline: 'none',
  boxSizing: 'border-box' as const,
  fontFamily: 'Metropolis, "Inter", sans-serif',
  transition: 'border-color 0.15s',
};

const LABEL = {
  display: 'block' as const,
  fontSize: '0.875rem',
  fontWeight: 600 as const,
  color: '#0F0F0E',
  marginBottom: '0.4rem',
};

const ERROR = {
  fontSize: '0.8125rem',
  color: '#DC2626',
  marginTop: '0.25rem',
};

const CARD: React.CSSProperties = {
  maxWidth: '640px', margin: '0 auto', background: '#FFFFFF',
  border: '1px solid #E8E6E1', borderRadius: '1.25rem',
  padding: 'clamp(1.75rem, 5vw, 2.75rem)', boxShadow: '0 24px 60px rgba(0,0,0,0.06)',
};

export default function DonateClient({ currency = 'NGN' }: { currency?: DonationCurrency }) {
  // Set by the server from where the donor is: naira in Nigeria, US dollars elsewhere.
  const limits = DONATION_LIMITS[currency];
  const PRESET_AMOUNTS: readonly number[] = limits.presets;
  const money = (n: number) => `${limits.symbol}${Number(n).toLocaleString(currency === 'USD' ? 'en-US' : 'en-NG')}`;
  const { alert } = useModal();
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<DonateFormValues>({
    resolver: zodResolver(donateFormSchemaFor(currency)),
    defaultValues: {
      full_name: '',
      email: '',
      phone: '',
      amount: PRESET_AMOUNTS[0],
      message: '',
    },
  });

  const [selectedPreset, setSelectedPreset] = useState<number | null>(PRESET_AMOUNTS[0]);
  const [customAmount, setCustomAmount] = useState('');
  const amount = watch('amount');

  // Non-null while the pre-payment confirmation overlay is showing
  const [pendingPayment, setPendingPayment] = useState<{ config: any; amountNaira: number } | null>(null);
  // Non-null while the post-payment success overlay is showing
  const [paymentSuccess, setPaymentSuccess] = useState<number | null>(null);
  const paymentStarting = useRef(false);
  const openPayment = useRef<{ reference: string; donationId: string } | null>(null);

  const reportAbandoned = (reference: string, donationId: string) => {
    try {
      fetch('/api/donate/abandon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, donationId }),
        keepalive: true,
      }).catch(() => undefined);
    } catch { /* best-effort */ }
  };

  useEffect(() => {
    const onLeave = () => {
      const op = openPayment.current;
      if (!op) return;
      try {
        navigator.sendBeacon(
          '/api/donate/abandon',
          new Blob([JSON.stringify(op)], { type: 'application/json' }),
        );
      } catch { /* best-effort */ }
    };
    window.addEventListener('pagehide', onLeave);
    return () => window.removeEventListener('pagehide', onLeave);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !document.getElementById('paystack-script')) {
      const s = document.createElement('script');
      s.id = 'paystack-script';
      // InlineJS v2: required for Apple Pay (and the wallet pre-checkout on Safari).
      s.src = 'https://js.paystack.co/v2/inline.js';
      s.async = true;
      document.head.appendChild(s);
    }
  }, []);

  const choosePreset = (value: number) => {
    setSelectedPreset(value);
    setCustomAmount('');
    setValue('amount', value, { shouldValidate: true });
  };

  const onCustomAmountChange = (raw: string) => {
    setCustomAmount(raw);
    setSelectedPreset(null);
    const n = Number(raw.replace(/[^0-9.]/g, ''));
    setValue('amount', Number.isFinite(n) ? n : 0, { shouldValidate: true });
  };

  const onSubmit = async (data: DonateFormValues) => {
    try {
      const res = await fetch('/api/donate/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const config = await res.json();

      if (!res.ok) {
        await alert(config.error || 'We could not start your donation. Please check your details and try again.', 'Something Went Wrong');
        return;
      }

      setPendingPayment({ config, amountNaira: config.amount / 100 });
    } catch {
      await alert('We could not start your donation. Please check your details and try again.', 'Something Went Wrong');
    }
  };

  const startPayment = async (config: any) => {
    if (paymentStarting.current) return;
    paymentStarting.current = true;
    try {
      if (typeof (window as any).PaystackPop === 'undefined') {
        paymentStarting.current = false;
        await alert('The payment script is still loading. Please refresh the page and try again.', 'Payment unavailable');
        return;
      }

      openPayment.current = { reference: config.reference, donationId: config.donationId };
      // v2 checkout(): on Safari/iOS it first offers Apple Pay (and Google Pay where available), then the usual card,
      // bank and transfer options. The reference we created on the server is passed through unchanged, so
      // /api/donate/verify matches it to this donation exactly as before.
      const popup = new (window as any).PaystackPop();
      let settled = false;
      await popup.checkout({
        key: config.public_key,
        email: config.email,
        amount: config.amount,
        currency: config.currency,
        reference: config.reference,
        metadata: {
          donation_id: config.donationId,
          full_name: config.full_name,
        },
        onSuccess: (transaction: { reference: string }) => {
          settled = true;
          openPayment.current = null;
          paymentStarting.current = false;
          verifyAndFinish(transaction.reference || config.reference, config.donationId, config.amount / 100);
        },
        onCancel: () => {
          if (settled) return;
          paymentStarting.current = false;
          if (openPayment.current) {
            reportAbandoned(openPayment.current.reference, openPayment.current.donationId);
            openPayment.current = null;
          }
          alert('You closed the payment window before finishing. Nothing was charged.', 'Payment Not Completed');
        },
        onError: () => {
          paymentStarting.current = false;
          openPayment.current = null;
          alert('We could not open the payment window. Please try again.', 'Something Went Wrong');
        },
      });
    } catch {
      paymentStarting.current = false;
      await alert('We could not process your donation. Please try again.', 'Something Went Wrong');
    }
  };

  const verifyAndFinish = async (reference: string, donationId: string, amountNaira: number) => {
    try {
      const res = await fetch('/api/donate/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference, donationId }),
      });

      if (res.ok) {
        reset();
        setSelectedPreset(PRESET_AMOUNTS[0]);
        setCustomAmount('');
        setPaymentSuccess(amountNaira);
        window.setTimeout(() => router.push('/donate/confirmed'), 3200);
      } else {
        await alert(
          "If you were charged, your donation is safe. Contact us with the email address you used and we'll confirm it manually within 24 hours.",
          "We Couldn't Verify Your Payment"
        );
      }
    } catch {
      await alert(
        "If you were charged, your donation is safe. Contact us with the email address you used and we'll confirm it manually within 24 hours.",
        "We Couldn't Verify Your Payment"
      );
    }
  };

  return (
    <>
      <main style={{ background: '#FAFAF8', minHeight: '100vh', padding: 'clamp(3rem, 8vw, 6rem) 1.5rem' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto 3rem', textAlign: 'center' }}>
          <img src="/ascentor-color-for-light-pages.svg" alt="Ascentor" style={{ height: 28, width: 'auto', margin: '0 auto 1.5rem', display: 'block' }} />
          <div className="mkt-gold-bar" style={{ margin: '0 auto 1.25rem' }} />
          <p className="mkt-eyebrow" style={{ marginBottom: '0.75rem' }}>Ascentor &middot; The Elevation Summit</p>
          <h1 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1.25rem', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
            Support the rise.
          </h1>
          <p style={{ color: '#6B7280', fontSize: '1.0625rem', lineHeight: 1.8, maxWidth: '560px', margin: '0 auto' }}>
            Your donation helps us build the room, the community, and the platform for the next
            generation of purposeful leaders. Every contribution, large or small, moves this forward.
          </p>
        </div>

        <div style={CARD}>
          <form onSubmit={handleSubmit(onSubmit)} className="donate-form">
            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Choose an amount ({limits.name}) *</label>
              <div className="donate-preset-grid">
                {PRESET_AMOUNTS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => choosePreset(v)}
                    className="donate-preset-btn"
                    aria-pressed={selectedPreset === v}
                    style={{
                      padding: '0.75rem 0.5rem',
                      borderRadius: '0.625rem',
                      border: selectedPreset === v ? '1.5px solid #C8A96E' : '1.5px solid #E8E6E1',
                      background: selectedPreset === v ? 'rgba(200,169,110,0.1)' : '#FAFAF8',
                      color: selectedPreset === v ? '#0F0F0E' : '#4B5563',
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      fontFamily: 'Metropolis, "Inter", sans-serif',
                      cursor: 'pointer',
                      transition: 'border-color 0.15s, background 0.15s',
                    }}
                  >
                    {money(v)}
                  </button>
                ))}
              </div>

              <label style={{ ...LABEL, marginTop: '1rem' }}>Or enter a custom amount</label>
              <input
                style={INPUT}
                type="text"
                inputMode="decimal"
                placeholder={currency === 'USD' ? 'e.g. 40' : 'e.g. 15,000'}
                value={customAmount}
                onChange={(e) => onCustomAmountChange(e.target.value)}
                onFocus={() => setSelectedPreset(null)}
              />
              {errors.amount && <p style={ERROR}>{errors.amount.message}</p>}
              {!errors.amount && amount > 0 && (
                <p style={{ fontSize: '0.8125rem', color: '#9CA3AF', marginTop: '0.375rem' }}>
                  You are donating {money(amount)}.
                </p>
              )}
            </div>

            <div>
              <label style={LABEL}>Full Name *</label>
              <input style={INPUT} type="text" {...register('full_name')} placeholder="Your full name" />
              {errors.full_name && <p style={ERROR}>{errors.full_name.message}</p>}
            </div>

            <div>
              <label style={LABEL}>Email Address *</label>
              <input style={INPUT} type="email" {...register('email')} placeholder="your@email.com" />
              {errors.email && <p style={ERROR}>{errors.email.message}</p>}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Phone Number *</label>
              <Controller
                name="phone"
                control={control}
                render={({ field }) => (
                  <PhoneInput
                    value={field.value || undefined}
                    onChange={field.onChange}
                    international
                    defaultCountry="NG"
                    flags={flags}
                    className="phone-input"
                    numberInputProps={{ style: INPUT, placeholder: '+234 800 000 0000' }}
                  />
                )}
              />
              {errors.phone && <p style={ERROR}>{errors.phone.message}</p>}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label style={LABEL}>Message <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(optional)</span></label>
              <textarea style={{ ...INPUT, resize: 'vertical', minHeight: '70px' }} {...register('message')} rows={3}
                placeholder="Say a word of encouragement, if you like." />
              {errors.message && <p style={ERROR}>{errors.message.message}</p>}
            </div>

            <button type="submit" className="btn-gold" disabled={isSubmitting}
              style={{ gridColumn: '1 / -1', width: '100%', justifyContent: 'center', padding: '0.875rem', fontSize: '1rem', border: 'none', cursor: 'pointer' }}>
              {isSubmitting ? 'Please wait...' : 'Donate Now →'}
            </button>

            <p style={{ gridColumn: '1 / -1', fontSize: '0.8125rem', color: '#9CA3AF', textAlign: 'center' }}>
              Payment is processed securely by Paystack. A receipt is emailed to you immediately after payment.
            </p>

            <style jsx>{`
              .donate-form {
                display: grid;
                grid-template-columns: 1fr;
                gap: 1rem;
              }
              .donate-preset-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 0.625rem;
              }
              @media (min-width: 480px) {
                .donate-preset-grid {
                  grid-template-columns: repeat(3, 1fr);
                }
              }
              @media (min-width: 768px) {
                .donate-form {
                  grid-template-columns: 1fr 1fr;
                }
                .donate-preset-grid {
                  grid-template-columns: repeat(5, 1fr);
                }
              }
              .phone-input input {
                width: 100%;
                padding: 0.75rem 1rem;
                font-size: 0.9375rem;
                border-radius: 0.625rem;
                border: 1.5px solid #E8E6E1;
                background: #FAFAF8;
                color: #0F0F0E;
                outline: none;
                box-sizing: border-box;
                font-family: 'Metropolis', 'Inter', sans-serif;
                transition: border-color 0.15s;
              }
              .phone-input input::placeholder,
              .donate-form input::placeholder,
              .donate-form textarea::placeholder {
                font-family: 'Metropolis', 'Inter', sans-serif;
                color: #9CA3AF;
              }
              .phone-input input:focus {
                border-color: #C8A96E;
              }
              .phone-input .PhoneInputCountry {
                padding-right: 0.75rem;
              }
            `}</style>
          </form>
        </div>

        <div style={{ maxWidth: '640px', margin: '2rem auto 0', textAlign: 'center' }}>
          <p style={{ color: '#9CA3AF', fontSize: '0.8125rem', display: 'inline-flex', alignItems: 'center', gap: '0.375rem' }}>
            <HeartHandshake size={15} /> Every donation goes directly toward Ascentor&apos;s programmes and The Elevation Summit.
          </p>
        </div>
      </main>

      {/* Pre-payment confirmation */}
      {pendingPayment && (
        <div
          role="alertdialog"
          aria-label="Confirm your donation"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 15, 14, 0.55)', backdropFilter: 'blur(6px)',
            padding: '1.5rem', animation: 'donateOverlayIn 0.25s ease-out',
          }}
        >
          <div style={{
            background: '#FFFFFF', borderRadius: '1.25rem',
            padding: '2.75rem 2.5rem 2.5rem', maxWidth: '440px', width: '100%',
            textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            animation: 'donateCardIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <h2 style={{ color: '#0F0F0E', fontSize: '1.625rem', fontWeight: 700, margin: '0 0 1.75rem' }}>
              Confirm Your Donation
            </h2>
            <p style={{ fontSize: '1.125rem', margin: '0 0 1.25rem' }}>
              <strong style={{ color: '#0F0F0E' }}>
                Amount: {money(pendingPayment.amountNaira)}
              </strong>
            </p>
            <p style={{ color: '#6B7280', lineHeight: 1.8, fontSize: '0.9375rem', margin: '0 0 2rem' }}>
              Click Confirm to proceed to secure payment. You will be redirected to{' '}
              <strong style={{ color: '#0F0F0E' }}>Paystack</strong>, our secure third-party payment provider.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  const p = pendingPayment;
                  setPendingPayment(null);
                  startPayment(p.config);
                }}
                className="btn-gold"
                style={{ fontSize: '0.9375rem', padding: '0.75rem 1.75rem', border: 'none', cursor: 'pointer' }}
              >
                Confirm →
              </button>
              <button
                onClick={() => setPendingPayment(null)}
                style={{
                  fontSize: '0.9375rem', padding: '0.75rem 1.75rem',
                  background: 'transparent', border: '1.5px solid #E8E6E1',
                  borderRadius: '0.625rem', color: '#6B7280', fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment success overlay */}
      {paymentSuccess != null && (
        <div
          role="alertdialog"
          aria-label="Donation confirmed"
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(15, 15, 14, 0.55)', backdropFilter: 'blur(6px)',
            padding: '1.5rem', animation: 'donateOverlayIn 0.25s ease-out',
          }}
        >
          <div style={{
            background: '#FFFFFF', borderRadius: '1.25rem',
            padding: '3rem 2.5rem 2.5rem', maxWidth: '420px', width: '100%',
            textAlign: 'center', boxShadow: '0 24px 80px rgba(0,0,0,0.35)',
            animation: 'donateCardIn 0.35s cubic-bezier(0.22, 1, 0.36, 1)',
          }}>
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: '#C8A96E', margin: '0 auto 1.5rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: 'donateCheckPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.1s both',
            }}>
              <Check size={36} color="#0F0F0E" strokeWidth={3} />
            </div>
            <h2 style={{ color: '#0F0F0E', fontSize: '1.75rem', fontWeight: 700, margin: '0 0 0.75rem' }}>
              Thank You
            </h2>
            <p style={{ color: '#6B7280', lineHeight: 1.7, fontSize: '1rem', margin: '0 0 2rem' }}>
              Your donation of {money(paymentSuccess)} was received. A receipt is on its way to your inbox.
            </p>
            <div style={{ height: '3px', borderRadius: '2px', background: '#F0EDE6', overflow: 'hidden', marginBottom: '1.5rem' }}>
              <div style={{ height: '100%', background: '#C8A96E', width: '0', animation: 'donateBarFill 3s linear forwards' }} />
            </div>
            <button
              onClick={() => router.push('/donate/confirmed')}
              className="btn-gold"
              style={{ fontSize: '0.9375rem', padding: '0.75rem 2rem', border: 'none', cursor: 'pointer' }}
            >
              Continue →
            </button>
          </div>

          <style>{`
            @keyframes donateOverlayIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes donateCardIn {
              from { opacity: 0; transform: translateY(16px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0) scale(1); }
            }
            @keyframes donateCheckPop {
              from { transform: scale(0); }
              to   { transform: scale(1); }
            }
            @keyframes donateBarFill { from { width: 0; } to { width: 100%; } }
          `}</style>
        </div>
      )}
    </>
  );
}
