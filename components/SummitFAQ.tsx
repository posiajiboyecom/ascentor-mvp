'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const leftColumnFaqs = [
  {
    question: 'What is the Elevation Summit',
    answer:
      'The Elevation Summit is a one day gathering on 19 November 2026 in Lagos, Nigeria, bringing together builders, leaders, and culture shapers for talks, conversations, and networking.',
  },
  {
    question: 'Can I attend virtually',
    answer:
      'Yes. A virtual ticket gives you access to the live sessions from wherever you are. The join link is emailed once your payment is confirmed.',
  },
  {
    question: 'What is the difference between onsite and virtual tickets',
    answer:
      'An onsite ticket gives you in person access to the venue in Lagos. A virtual ticket gives you live online access to the sessions. Content covered is the same for both.',
  },
  {
    question: 'How much do tickets cost',
    answer:
      'Onsite attendance is 5,000 naira. Virtual attendance is 3,000 naira.',
  },
  {
    question: 'Do I need to bring anything if attending onsite',
    answer:
      'Come ready to learn and to network. Bring a notepad or something to take notes with, and whatever helps you stay fully present for the day. Onsite logistics details will be shared closer to the event date.',
  },
];

const rightColumnFaqs = [
  {
    question: 'Will sessions be recorded',
    answer:
      'Sessions will not be recorded. Highlights and key moments will be shared on our social media channels after the event.',
  },
  {
    question: 'What is the refund and cancellation policy',
    answer: (
      <>
        Our refund and cancellation policy is being finalized and will be published here before the event. If you need help with a specific situation, reach out through our{' '}
        <a href="/contact" style={{ color: '#C8A96E', textDecoration: 'underline' }}>contact page</a>.
      </>
    ),
  },
  {
    question: 'Is there a dress code',
    answer: 'No. There is no dress code. Come as you are.',
  },
  {
    question: 'Can I switch from a virtual ticket to an onsite ticket',
    answer:
      'No. Tickets cannot be switched after purchase, so please choose the attendance type that works for you before completing registration.',
  },
  {
    question: 'How do I contact the organizers',
    answer: (
      <>
        Reach out through our{' '}
        <a href="/contact" style={{ color: '#C8A96E', textDecoration: 'underline' }}>contact page</a>
        {' '}or reply to your registration confirmation email.
      </>
    ),
  },
];

function FaqItem({
  faq,
  id,
  isOpen,
  onToggle,
}: {
  faq: { question: string; answer: React.ReactNode };
  id: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{ borderBottom: '1px solid #E8E6E1' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls={id}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '1rem',
          padding: '1.25rem 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontWeight: 600, color: '#0F0F0E', fontSize: '1rem' }}>{faq.question}</span>
        <ChevronDown
          size={20}
          style={{
            color: '#C8A96E',
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.25s ease',
          }}
        />
      </button>
      {isOpen && (
        <div id={id} role="region" className="faq-answer-open">
          <p style={{ fontSize: '0.875rem', color: '#6B7280', lineHeight: 1.7, paddingBottom: '1.25rem', margin: 0 }}>
            {faq.answer}
          </p>
        </div>
      )}
    </div>
  );
}

export default function SummitFAQ() {
  const [openId, setOpenId] = useState<string | null>(null);
  const toggle = (id: string) => setOpenId((prev) => (prev === id ? null : id));

  return (
    <section style={{ padding: 'clamp(4rem, 8vw, 7rem) 1.5rem', background: '#FFFFFF' }}>
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        <p className="mkt-eyebrow" style={{ textAlign: 'center', marginBottom: '1rem' }}>Frequently Asked Questions</p>
        <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', textAlign: 'center', marginBottom: '2.5rem', fontSize: 'clamp(1.75rem, 3.5vw, 2.5rem)' }}>
          You've got questions. We've got answers.
        </h2>
        <div className="summit-faq-grid">
          <div>
            {leftColumnFaqs.map((faq, i) => (
              <FaqItem
                key={faq.question}
                faq={faq}
                id={`faq-left-${i}`}
                isOpen={openId === `faq-left-${i}`}
                onToggle={() => toggle(`faq-left-${i}`)}
              />
            ))}
          </div>
          <div>
            {rightColumnFaqs.map((faq, i) => (
              <FaqItem
                key={faq.question}
                faq={faq}
                id={`faq-right-${i}`}
                isOpen={openId === `faq-right-${i}`}
                onToggle={() => toggle(`faq-right-${i}`)}
              />
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        .summit-faq-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0 3rem;
        }
        .faq-answer-open {
          animation: faqFadeIn 0.2s ease;
        }
        @keyframes faqFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @media (min-width: 768px) {
          .summit-faq-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>
    </section>
  );
}
