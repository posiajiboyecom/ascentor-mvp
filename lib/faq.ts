// lib/faq.ts
// The public FAQ: the page and its FAQPage schema both read this list, so what search engines see is what visitors read.
// Questions are the SEO kit's. Each answer is one to three sentences and starts with the answer. Answers use only facts from
// the SEO kit or the product itself.
// TODO(posi): the kit lists the questions but not the answers. Check the wording of "Is it free?", "Who are the mentors?"
// and "How is it different from a networking group?", which need your decision on what to promise.
import { ONE_LINER } from '@/lib/seo';

export const FAQ: { q: string; a: string }[] = [
  { q: 'What is Ascentor?', a: ONE_LINER },
  {
    q: 'Who is it for?',
    a: 'Ascentor is for ambitious young Africans at any of three stages: Seekers who are still finding their thread, Builders who know where they are going and are doing the daily work, and Leaders who are responsible for others.',
  },
  {
    q: 'Is it free?',
    a: 'The Elevation Summit is free to attend, onsite or virtually. Ascentor membership is offered as Seeker, Builder and Leader plans, and the price of each, in naira, is shown before you pay.',
  },
  {
    q: 'What is a Circle?',
    a: 'A Circle is a small group of 8-10 members who hold each other accountable and work with a human mentor. Circles meet to build together across the six dimensions: Mind, Character, Vocation, Relationships, Community and Legacy.',
  },
  {
    q: 'What is Sage?',
    a: 'Sage is Ascentor’s AI coach. It helps members prepare for decisions and conversations and keep their commitments between sessions, and it is always labelled as an AI coach.',
  },
  {
    q: 'Who are the mentors?',
    a: 'Mentors are real people, not AI. Your Circle chooses a mentor together and books sessions with them.',
  },
  {
    q: 'How is it different from a networking group?',
    a: 'A networking group is built around meeting people; Ascentor is built around building a life. You get a Circle that holds you accountable, a human mentor, and Sage, an AI coach, across six dimensions of a whole life.',
  },
];

export function faqSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };
}
