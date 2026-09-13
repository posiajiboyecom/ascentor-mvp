import Image from 'next/image';
import { Linkedin, Instagram } from 'lucide-react';

interface Speaker {
  name: string;
  role: string;
  topic: string;
  photo: string;
  linkedinUrl?: string;
  instagramUrl?: string;
}

// First entry is real data. The other five are placeholders sharing the
// same photo until their real details arrive.
const speakers: Speaker[] = [
  {
    name: 'Samuel Peniel',
    role: 'Setman, Reign Global',
    topic: 'The Emergence Of Culture Shapers',
    photo: '/images/speakers/samuel-peniel.jpg',
    instagramUrl: 'https://www.instagram.com/apostlesamuelpeniel/?hl=en',
  },
  {
    name: 'Speaker Name',
    role: 'Role to be announced',
    topic: 'Topic to be announced',
    photo: '/images/speakers/samuel-peniel.jpg',
  },
  {
    name: 'Speaker Name',
    role: 'Role to be announced',
    topic: 'Topic to be announced',
    photo: '/images/speakers/samuel-peniel.jpg',
  },
  {
    name: 'Speaker Name',
    role: 'Role to be announced',
    topic: 'Topic to be announced',
    photo: '/images/speakers/samuel-peniel.jpg',
  },
  {
    name: 'Speaker Name',
    role: 'Role to be announced',
    topic: 'Topic to be announced',
    photo: '/images/speakers/samuel-peniel.jpg',
  },
  {
    name: 'Speaker Name',
    role: 'Role to be announced',
    topic: 'Topic to be announced',
    photo: '/images/speakers/samuel-peniel.jpg',
  },
];

export default function SummitSpeakers() {
  return (
    <section style={{ background: '#FAFAF8', padding: 'clamp(4rem, 8vw, 7rem) 1.5rem' }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ marginBottom: '3.5rem', maxWidth: '640px' }}>
          <p className="mkt-eyebrow" style={{ marginBottom: '1rem' }}>Speakers</p>
          <h2 className="mkt-section-headline" style={{ color: '#0F0F0E', marginBottom: '1rem' }}>
            Voices shaping the room.
          </h2>
          <p style={{ color: '#6B7280', fontSize: '1rem', lineHeight: 1.75 }}>
            Builders, leaders, and culture shapers bringing the conversations that matter. More speakers to be announced.
          </p>
        </div>

        <div className="summit-speakers-grid">
          {speakers.map((speaker, i) => (
            <div key={`${speaker.name}-${i}`} className="summit-speaker-card">
              <div className="summit-speaker-photo" style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', borderRadius: '1rem', overflow: 'hidden', background: '#E8E6E1' }}>
                <Image
                  src={speaker.photo}
                  alt={speaker.name}
                  fill
                  sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                  style={{ objectFit: 'cover' }}
                />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: '#0F0F0E', marginTop: '1rem' }}>
                {speaker.name}
              </h3>
              <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>{speaker.role}</p>
              <p style={{ fontSize: '0.875rem', color: '#C8A96E', fontWeight: 600, marginTop: '0.25rem' }}>{speaker.topic}</p>

              {speaker.linkedinUrl ? (
                <a
                  href={speaker.linkedinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Connect with ${speaker.name} on LinkedIn`}
                  className="summit-speaker-social summit-speaker-linkedin"
                >
                  <Linkedin size={16} /> Connect on LinkedIn
                </a>
              ) : speaker.instagramUrl ? (
                <a
                  href={speaker.instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow ${speaker.name} on Instagram`}
                  className="summit-speaker-social summit-speaker-instagram"
                >
                  <Instagram size={16} /> Follow on Instagram
                </a>
              ) : (
                <span className="summit-speaker-social summit-speaker-linkedin" aria-hidden="true">
                  <Linkedin size={16} /> Connect on LinkedIn
                </span>
              )}
            </div>
          ))}

        </div>
      </div>

      <style jsx>{`
        .summit-speakers-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 4rem 2.5rem;
        }
        .summit-speaker-social {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.875rem;
          padding: 0.5rem 1rem;
          border-radius: 0.5rem;
          font-size: 0.8125rem;
          font-weight: 600;
          color: #FFFFFF;
          text-decoration: none;
          transition: background 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
        }
        .summit-speaker-linkedin {
          background: #0A66C2;
        }
        .summit-speaker-linkedin:hover {
          background: #084D94;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(10, 102, 194, 0.35);
        }
        .summit-speaker-instagram {
          background: #E1306C;
        }
        .summit-speaker-instagram:hover {
          background: #B92A5B;
          transform: translateY(-2px);
          box-shadow: 0 6px 16px rgba(225, 48, 108, 0.35);
        }
        .summit-speaker-card {
          text-align: left;
          padding: 1rem;
          margin: -1rem;
          border-radius: 1.25rem;
          transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        .summit-speaker-card:hover {
          transform: translateY(-6px);
          background: #FFFFFF;
          box-shadow: 0 12px 32px rgba(15, 15, 14, 0.08);
        }
        .summit-speaker-photo img {
          transition: transform 0.4s ease;
        }
        .summit-speaker-card:hover .summit-speaker-photo img {
          transform: scale(1.05);
        }
        @media (min-width: 640px) {
          .summit-speakers-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 768px) {
          .summit-speakers-grid {
            grid-template-columns: repeat(3, 1fr);
            gap: 2.5rem;
          }
        }
      `}</style>
    </section>
  );
}
