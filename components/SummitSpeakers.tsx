import Image from 'next/image';
import { Linkedin, Instagram } from 'lucide-react';

interface Speaker {
  name: string;
  role?: string;
  topic?: string;
  photo?: string;
  // null = speaker has no account on that platform (button hidden).
  // undefined = URL not yet provided (button renders, links to '#').
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
}

// Speakers without a headshot reuse Samuel Peniel's photo as a
// placeholder until their real photos arrive.
const PLACEHOLDER_PHOTO = '/images/speakers/samuel-peniel.jpg';
const speakers: Speaker[] = [
  {
    name: 'Posi Ajiboye',
    role: 'Founder, Ascentor',
    topic: 'The Rise We Choose: Building the Man, The Nation, and Continent',
    photo: '/images/speakers/posi-ajiboye.png',
  },
  {
    name: 'Samuel Peniel',
    role: 'Setman, Reign Global',
    topic: 'The Discipline to Stay: A Case for Both Narrow Focus and Range in Building a Life That Lasts',
    photo: '/images/speakers/samuel-peniel.jpg',
    linkedinUrl: null,
    instagramUrl: 'https://www.instagram.com/apostlesamuelpeniel/?hl=en',
  },
  {
    name: 'Kemeshi Samuel',
    role: 'Co-founder & Chief Marketing Officer, FirstFounders Ltd.',
    topic: 'Indigenous or Borrowed Blueprints: A Case for Both the African Mind and Importation of Things That Work as a Way to Fast-Track Our Participation in the Ongoing Global Revolution',
    photo: '/images/speakers/kemeshi-samuel.jpeg',
    linkedinUrl: 'https://www.linkedin.com/in/samuel-kemeshi-610669144',
  },
  {
    name: "'Lekan Omotosho",
    role: 'Data Scientist & ML Engineer',
    topic: 'The Elevation Within: My Rise from Curiosity to Global AI Impact',
    photo: PLACEHOLDER_PHOTO,
  },
  {
    name: 'Akintomiwa Samuel O.',
    role: 'Founder/CEO, Ploy',
    topic: "Manual or Machine: A Case for Both the Craft of Small Business and AI as Africa's Next Leap",
    photo: PLACEHOLDER_PHOTO,
  },
  {
    name: 'Demo Name',
    role: 'Role to be announced',
    topic: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt',
    photo: PLACEHOLDER_PHOTO,
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
                  src={speaker.photo ?? PLACEHOLDER_PHOTO}
                  alt={speaker.name}
                  fill
                  sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                  style={{ objectFit: 'cover', objectPosition: 'center top' }}
                />
              </div>
              <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.125rem', fontWeight: 700, color: '#0F0F0E', marginTop: '1rem' }}>
                {speaker.name}
              </h3>
              {speaker.role && (
                <p style={{ fontSize: '0.875rem', color: '#6B7280', marginTop: '0.25rem' }}>{speaker.role}</p>
              )}
              {speaker.topic && (
                <>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#9CA3AF', marginTop: '0.875rem' }}>
                    Speaking on
                  </p>
                  <p style={{ fontSize: '0.875rem', color: '#0F0F0E', fontWeight: 600, marginTop: '0.25rem', lineHeight: 1.5 }}>{speaker.topic}</p>
                </>
              )}

              <div style={{ display: 'flex', gap: '0.625rem', marginTop: '0.875rem', flexWrap: 'wrap' }}>
                {speaker.linkedinUrl !== null && (
                  <a
                    href={speaker.linkedinUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${speaker.name} on LinkedIn`}
                    className="summit-speaker-social summit-speaker-linkedin"
                  >
                    <Linkedin size={16} /> LinkedIn
                  </a>
                )}
                {speaker.instagramUrl !== null && (
                  <a
                    href={speaker.instagramUrl ?? '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`${speaker.name} on Instagram`}
                    className="summit-speaker-social summit-speaker-instagram"
                  >
                    <Instagram size={16} /> Instagram
                  </a>
                )}
              </div>
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
