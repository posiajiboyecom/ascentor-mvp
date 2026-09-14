'use client';

import Image from 'next/image';
import { useState } from 'react';

interface Speaker {
  name: string;
  role?: string;
  topic?: string;
  bio?: string;
  photo?: string;
  // null = speaker has no account on that platform (icon hidden).
  // undefined = not yet provided (icon renders, links to '#').
  linkedinUrl?: string | null;
  instagramUrl?: string | null;
  host?: boolean;
}

const PLACEHOLDER_PHOTO = '/images/speakers/samuel-peniel.jpg';

const speakers: Speaker[] = [
  {
    name: 'Posi Ajiboye',
    role: 'Founder, Ascentor',
    topic: 'The Rise We Choose: Building the Man, The Nation, and Continent',
    bio: 'Posi Ajiboye is a Quality Assurance Analyst at Anifie Inc., a creative and multimedia company based in Irvine, California, whose clients include Honda, Toyota, Cartier, Hitachi, and Fujitsu. He brings together technical rigor with a passion for purposeful leadership - holding a degree in Information Systems among many professional certifications. He maintains an independent security research portfolio spanning Security Engineering, API security, and AI/LLM security. He is also the founder behind Ascentor, the platform of The Elevation Summit, a global community and movement dedicated to purposeful living, leadership, and lasting impact, culminating in yearly convocation of intellectuals and builders across Africa. His work sits at the intersection of Technology, Business, and Human development, building things that connect people and help them build lives that outlast them.',
    photo: '/images/speakers/posi-ajiboye.png',
    linkedinUrl: 'https://www.linkedin.com/in/ayomiposiajiboye/',
    instagramUrl: 'https://www.instagram.com/posi_ajiboye/',
    host: true,
  },
  {
    name: 'Samuel Peniel',
    role: 'President, Reign Global',
    topic: 'The Discipline to Stay: A Case for Both Narrow Focus and Range in Building a Life That Lasts',
    bio: 'Samuel Peniel is the Setman of Reign Global, a ministry and community movement centred on raising whole men and women of purpose. He is a teacher, preacher, and leader whose work bridges the gap between spiritual depth and practical living. His sessions are known for their rigour, clarity, and lasting impact on those who encounter them.',
    photo: '/images/speakers/samuel-peniel.jpg',
    linkedinUrl: null,
    instagramUrl: 'https://www.instagram.com/apostlesamuelpeniel/?hl=en',
  },
  {
    name: 'Kemeshi Samuel',
    role: 'Co-founder & Chief Marketing Officer, FirstFounders Ltd.',
    topic: 'Indigenous or Borrowed Blueprints: A Case for Both the African Mind and Importation of Things That Work as a Way to Fast-Track Our Participation in the Ongoing Global Revolution',
    bio: 'Kemeshi Samuel is Co-founder and Chief Marketing Officer at FirstFounders Ltd., a venture studio and ecosystem collective focused on helping early-stage African tech startups develop ideas into investable businesses. He is a VC analyst, ecosystem builder, and host of the Made in Africa podcast by Jamit, a show crafted to tell the stories of successful African founders to inspire young entrepreneurs to greatness. Some of the world-class founders he has interviewed include David Lanre Messan (Founder and CEO at FirstFounders Inc.), Iyinoluwa Aboyeji (Founding Partner at Future Africa), Babatunde Akin Moses (Co-founder and CEO at Sycamore), and Fisayo Fosudo (Tech YouTuber and Filmmaker), among others. Kemeshi Samuel is a trained and certified content marketer, one-time TEDx speaker, and founder of The Hustle Run Club.',
    photo: '/images/speakers/kemeshi-samuel.jpeg',
    linkedinUrl: 'https://www.linkedin.com/in/samuel-kemeshi-610669144',
    instagramUrl: undefined,
  },
  {
    name: "'Lekan Omotosho",
    role: 'AI Engineer, Turing',
    topic: 'The Elevation Within: My Rise from Curiosity to Global AI Impact',
    bio: "Olamilekan Matthew Omotosho is a Data Scientist and AI Engineer with over four years of experience working across machine learning, Generative AI, and AI research. He currently works with Turing, where he contributes to the development and evaluation of Large Language Models through reinforcement learning, supervised fine-tuning, and AI evaluation. A graduate of the Federal University of Technology, Akure, Olamilekan was the Best Graduating Student in the School of Computing, graduating with a CGPA of 4.83/5.00. His journey began with a simple curiosity about data and has grown into work spanning AI, healthcare, and intelligent systems. Beyond his professional work, Olamilekan is passionate about building communities and helping young Africans participate in technology. He has served as a Zindi Ambassador, Community Lead at Data Science Nigeria FUTA, Microsoft Learn Student Ambassador, and mentor across several tech communities. His contributions have earned him recognition within Nigeria's technology ecosystem and connected him with global AI, data science, and developer communities.",
    photo: '/images/speakers/lekan-omotosho.jpg',
    linkedinUrl: undefined,
    instagramUrl: undefined,
  },
  {
    name: 'Akintomiwa Samuel O.',
    role: 'Founder/CEO, Ploy',
    topic: "Manual or Machine: A Case for Both the Craft of Small Business and AI as Africa's Next Leap",
    bio: 'Akintomiwa Samuel O. is the Founder and CEO of Ploy, a platform reimagining how small businesses in Africa operate and scale. He is an entrepreneur and systems thinker who believes that the next leap for African business lies at the intersection of deep craft and intelligent technology. His work at Ploy is building the tools that bridge that gap for thousands of entrepreneurs.',
    photo: PLACEHOLDER_PHOTO,
    linkedinUrl: undefined,
    instagramUrl: undefined,
  },
  {
    name: 'Speaker TBA',
    role: 'To be announced',
    topic: 'Topic to be announced',
    bio: 'Details for this speaker will be shared soon. We are curating voices that will challenge, stretch, and inspire everyone in the room.',
    photo: PLACEHOLDER_PHOTO,
    linkedinUrl: null,
    instagramUrl: null,
  },
];

export default function SummitSpeakers() {
  const [selected, setSelected] = useState<Speaker | null>(null);

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
              {/* Photo */}
              <div className="summit-speaker-photo">
                <Image
                  src={speaker.photo ?? PLACEHOLDER_PHOTO}
                  alt={speaker.name}
                  fill
                  sizes="(min-width: 768px) 33vw, (min-width: 640px) 50vw, 100vw"
                  style={{ objectFit: 'cover', objectPosition: 'center top' }}
                />
              </div>

              {/* Info */}
              <h3 className="summit-speaker-name">{speaker.name}</h3>
              {speaker.role && (
                <p className="summit-speaker-role">{speaker.role}</p>
              )}
              {speaker.host && (
                <span className="summit-host-pill">Host</span>
              )}
              {speaker.topic && (
                <>
                  <p className="summit-speaker-label">Speaking on</p>
                  <p className="summit-speaker-topic">{speaker.topic}</p>
                </>
              )}

              {/* Actions row: Read Profile button then circular social icons */}
              <div className="summit-speaker-actions">
                {speaker.bio && (
                  <button
                    className="summit-read-profile"
                    onClick={() => setSelected(speaker)}
                  >
                    Read Profile
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: '0.375rem' }}>
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  </button>
                )}

                <div className="summit-social-row">
                  {speaker.linkedinUrl !== null && (
                    <a
                      href={speaker.linkedinUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${speaker.name} on LinkedIn`}
                      className="summit-social-icon summit-social-linkedin"
                    >
                      {/* LinkedIn "in" icon */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                      </svg>
                    </a>
                  )}
                  {speaker.instagramUrl !== null && (
                    <a
                      href={speaker.instagramUrl ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${speaker.name} on Instagram`}
                      className="summit-social-icon summit-social-instagram"
                    >
                      {/* Instagram camera icon */}
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                      </svg>
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Profile modal */}
      {selected && (
        <div
          className="ssp-backdrop"
          onClick={(e) => { if (e.target === e.currentTarget) setSelected(null); }}
          role="dialog"
          aria-modal="true"
          aria-label={`${selected.name} profile`}
        >
          <div className="ssp-modal">
            {/* Close */}
            <button
              className="ssp-close"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12"/>
              </svg>
            </button>

            {/* Header */}
            <div className="ssp-header">
              <div className="ssp-avatar">
                <Image
                  src={selected.photo ?? PLACEHOLDER_PHOTO}
                  alt={selected.name}
                  fill
                  sizes="96px"
                  style={{ objectFit: 'cover', objectPosition: 'center top' }}
                />
              </div>
              <div className="ssp-header-text">
                <h2 className="ssp-name">{selected.name}</h2>
                {selected.role && <p className="ssp-role">{selected.role}</p>}
              </div>
              {/* Social icons sit in the same row, beside the name/title column */}
              <div className="ssp-header-socials">
                {selected.linkedinUrl !== null && (
                  <a href={selected.linkedinUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                     aria-label="LinkedIn" className="summit-social-icon summit-social-linkedin">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </a>
                )}
                {selected.instagramUrl !== null && (
                  <a href={selected.instagramUrl ?? '#'} target="_blank" rel="noopener noreferrer"
                     aria-label="Instagram" className="summit-social-icon summit-social-instagram">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/>
                    </svg>
                  </a>
                )}
              </div>
            </div>

            {/* Gold divider */}
            <div className="ssp-divider" />

            {/* Topic */}
            {selected.topic && (
              <div className="ssp-topic-wrap">
                <p className="summit-speaker-label" style={{ marginBottom: '0.375rem' }}>Speaking on</p>
                <p className="ssp-topic-text">{selected.topic}</p>
              </div>
            )}

            {/* Bio */}
            {selected.bio && (
              <p className="ssp-bio">{selected.bio}</p>
            )}
          </div>
        </div>
      )}

      <style jsx>{`
        /* ── Grid ── */
        .summit-speakers-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3.5rem 2.5rem;
        }
        @media (min-width: 640px) {
          .summit-speakers-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 768px) {
          .summit-speakers-grid { grid-template-columns: repeat(3, 1fr); gap: 2.5rem; }
        }

        /* ── Card ── */
        .summit-speaker-card {
          text-align: left;
          padding: 1rem;
          margin: -1rem;
          border-radius: 1.25rem;
          transition: transform 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
        }
        .summit-speaker-card:hover {
          transform: translateY(-4px);
          background: #FFFFFF;
          box-shadow: 0 12px 32px rgba(15,15,14,0.08);
        }

        /* ── Photo ── */
        .summit-speaker-photo {
          position: relative;
          width: 100%;
          aspect-ratio: 1 / 1;
          border-radius: 1rem;
          overflow: hidden;
          background: #E8E6E1;
        }

        /* ── Text ── */
        .summit-speaker-name {
          font-family: var(--font-display);
          font-size: 1.125rem;
          font-weight: 700;
          color: #0F0F0E;
          margin: 1rem 0 0;
        }
        .summit-speaker-role {
          font-size: 0.875rem;
          color: #6B7280;
          margin: 0.25rem 0 0;
        }
        .summit-host-pill {
          display: inline-block;
          background: #0F0F0E;
          color: #FFFFFF;
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          padding: 0.35rem 0.75rem;
          border-radius: 999px;
          margin-top: 0.5rem;
        }
        .summit-speaker-label {
          font-size: 0.6875rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: #9CA3AF;
          margin: 0.875rem 0 0;
        }
        .summit-speaker-topic {
          font-size: 0.875rem;
          color: #0F0F0E;
          font-weight: 600;
          margin: 0.25rem 0 0;
          line-height: 1.5;
        }

        /* ── Actions row ── */
        .summit-speaker-actions {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          margin-top: 1rem;
          flex-wrap: wrap;
        }
        .summit-social-row {
          display: flex;
          gap: 0.5rem;
        }

        /* ── Circular social icons ── */
        .summit-social-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 34px;
          height: 34px;
          border-radius: 50%;
          text-decoration: none;
          transition: transform 0.18s, opacity 0.18s;
        }
        .summit-social-icon:hover { transform: scale(1.12); opacity: 0.85; }
        .summit-social-linkedin { background: #0A66C2; color: #FFFFFF; }
        .summit-social-instagram { background: #E1306C; color: #FFFFFF; }

        /* ── Read Profile button ── */
        .summit-read-profile {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.375rem;
          padding: 0.5rem 1rem;
          border-radius: 10px;
          border: none;
          background: #0F0F0E;
          color: #FFFFFF;
          font-family: Metropolis, 'Inter', sans-serif;
          font-size: 0.8125rem;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.18s, color 0.18s;
        }
        .summit-read-profile:hover {
          background: #C8A96E;
          color: #0F0F0E;
        }

        /* ── Modal backdrop ── */
        .ssp-backdrop {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: rgba(15,15,14,0.6);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          animation: ssp-fade-in 0.2s ease;
        }
        @keyframes ssp-fade-in {
          from { opacity: 0; }
          to   { opacity: 1; }
        }

        /* ── Modal card ── */
        .ssp-modal {
          position: relative;
          background: #FFFFFF;
          border-radius: 1.25rem;
          width: 100%;
          max-width: 560px;
          max-height: 88vh;
          overflow-y: auto;
          padding: 2rem;
          box-shadow: 0 24px 64px rgba(15,15,14,0.2);
          animation: ssp-slide-up 0.25s cubic-bezier(0.22,1,0.36,1);
        }
        @keyframes ssp-slide-up {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        /* ── Close button ── */
        .ssp-close {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          border: 1.5px solid #E8E6E1;
          background: #FAFAF8;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #6B7280;
          transition: background 0.15s, color 0.15s;
        }
        .ssp-close:hover { background: #0F0F0E; color: #FFFFFF; border-color: #0F0F0E; }

        /* ── Modal header ── */
        .ssp-header {
          display: flex;
          align-items: center;
          gap: 1.25rem;
          padding-right: 2.5rem;
          flex-wrap: wrap;
        }
        .ssp-avatar {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 50%;
          overflow: hidden;
          background: #E8E6E1;
          flex-shrink: 0;
        }
        .ssp-header-text { flex: 1; min-width: 160px; }
        .ssp-header-socials {
          display: flex;
          gap: 0.875rem;
          align-items: center;
        }
        .ssp-name {
          font-family: var(--font-display);
          font-size: 1.25rem;
          font-weight: 700;
          color: #0F0F0E;
          margin: 0;
        }
        .ssp-role {
          font-size: 0.875rem;
          color: #6B7280;
          margin: 0.25rem 0 0;
        }

        /* ── Divider ── */
        .ssp-divider {
          height: 3px;
          background: #C8A96E;
          border-radius: 2px;
          margin: 1.5rem 0;
        }

        /* ── Topic block ── */
        .ssp-topic-wrap { margin-bottom: 1.25rem; }
        .ssp-topic-text {
          font-size: 0.9375rem;
          font-weight: 600;
          color: #0F0F0E;
          line-height: 1.6;
          margin: 0.25rem 0 0;
        }

        /* ── Bio ── */
        .ssp-bio {
          font-size: 0.9375rem;
          color: #3F3F3C;
          line-height: 1.8;
          margin: 0;
        }
      `}</style>
    </section>
  );
}
