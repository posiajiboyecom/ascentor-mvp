'use client';

import { useEffect, useState } from 'react';

// WAT (UTC+1). NOTE: 09:00 start time is an assumption, still unconfirmed.
const EVENT_DATE = new Date('2026-11-19T09:00:00+01:00');

function getTimeRemaining() {
  const total = EVENT_DATE.getTime() - Date.now();
  const days = Math.max(0, Math.floor(total / (1000 * 60 * 60 * 24)));
  const hours = Math.max(0, Math.floor((total / (1000 * 60 * 60)) % 24));
  const minutes = Math.max(0, Math.floor((total / (1000 * 60)) % 60));
  const seconds = Math.max(0, Math.floor((total / 1000) % 60));
  return { total, days, hours, minutes, seconds };
}

export default function SummitCountdown() {
  const [time, setTime] = useState(getTimeRemaining());

  useEffect(() => {
    const interval = setInterval(() => setTime(getTimeRemaining()), 1000);
    return () => clearInterval(interval);
  }, []);

  const unitLabel =
    time.total <= 0
      ? 'The Summit is happening now'
      : `${time.days} days, ${time.hours} hours, ${time.minutes} minutes, ${time.seconds} seconds remaining`;

  return (
    <section style={{ background: '#0F0F0E', color: '#FAFAF8', padding: 'clamp(4rem, 8vw, 6rem) 1.5rem' }}>
      <div style={{ maxWidth: '56rem', margin: '0 auto', textAlign: 'center' }}>
        <p className="mkt-eyebrow" style={{ marginBottom: '1.25rem' }}>Time Is Running</p>
        <h2 className="mkt-section-headline" style={{ color: '#FAFAF8', marginBottom: '1rem', fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}>
          The room is filling. The clock is not waiting for you.
        </h2>
        <p style={{ color: '#9CA3AF', fontSize: '1.0625rem', lineHeight: 1.75, maxWidth: '36rem', margin: '0 auto 3rem' }}>
          Every seat taken is one less available. Secure yours before registration closes.
        </p>

        {time.total <= 0 ? (
          <p style={{ fontSize: '1.25rem', fontWeight: 600 }}>The Summit is happening now</p>
        ) : (
          <div
            className="summit-countdown-grid"
            aria-live="polite"
            aria-label={unitLabel}
          >
            {([
              ['Days', time.days],
              ['Hours', time.hours],
              ['Minutes', time.minutes],
              ['Seconds', time.seconds],
            ] as [string, number][]).map(([label, value]) => (
              <div
                key={label}
                style={{
                  background: 'rgba(250, 250, 248, 0.06)',
                  border: '1px solid rgba(200, 169, 110, 0.35)',
                  borderRadius: '1rem',
                  padding: '1.5rem 1.75rem',
                  minWidth: '7.5rem',
                }}
              >
                <div style={{ fontSize: 'clamp(2.5rem, 6vw, 3.5rem)', fontWeight: 800, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)', color: '#C8A96E', lineHeight: 1 }}>
                  {String(value).padStart(2, '0')}
                </div>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.12em', color: '#9CA3AF', marginTop: '0.5rem', fontWeight: 600 }}>
                  {label}
                </div>
              </div>
            ))}
          </div>
        )}

        <p style={{ fontSize: '0.875rem', color: '#9CA3AF', marginTop: '2rem' }}>19 November 2026, Lagos, Nigeria</p>

        <a
          href="#register"
          className="btn-gold"
          style={{ display: 'inline-flex', marginTop: '2rem', fontSize: '1rem', padding: '0.875rem 2.25rem' }}
        >
          Secure Your Seat Now
        </a>
      </div>

      <style jsx>{`
        .summit-countdown-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1rem;
          max-width: 20rem;
          margin: 0 auto;
        }
        @media (min-width: 640px) {
          .summit-countdown-grid {
            grid-template-columns: repeat(4, 1fr);
            max-width: none;
          }
        }
      `}</style>
    </section>
  );
}
