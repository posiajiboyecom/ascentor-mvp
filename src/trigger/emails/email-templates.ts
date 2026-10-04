// ═══ ASCENTOR EMAIL TEMPLATES ═══
// All emails use the shared branded shell from lib/emailTemplate.ts -
// the same layout rendered for summit payment confirmations.
import { brandedEmailLayout, esc, p, goldButton, summaryBox, summaryRow } from '@/lib/emailTemplate';

const APP_URL = 'https://ascentorbi.com';

// ═══ WELCOME EMAIL ═══
export function welcomeEmail(name: string, email = '') {
  const firstName = esc(name?.split(' ')[0] || 'there');
  return {
    subject: `Welcome to Ascentor, ${firstName}`,
    html: brandedEmailLayout({
      preheader: 'Your leadership journey starts now.',
      eyebrow: 'Welcome to Ascentor',
      heading: `Welcome, ${firstName}.`,
      recipient: email,
      content:
        p(`Hi ${firstName},`) +
        p('We are glad you joined. Ascentor is your platform for purposeful growth, AI-powered coaching, and a community of individuals building lives that last.') +
        p('<strong>Here is how to get started:</strong>') +
        p('1. Start an AI coaching session and share your biggest leadership challenge.') +
        p('2. Browse the community and introduce yourself.') +
        p('3. Register for the Elevation Summit, 19 November 2026, Lagos.') +
        goldButton('Go to Your Dashboard', `${APP_URL}/dashboard`),
    }),
  };
}

// ═══ COACHING SUMMARY EMAIL ═══
export function coachingSummaryEmail(
  name: string,
  summary: string,
  keyTakeaways: string[],
  nextSteps: string[],
  email = ''
) {
  const firstName = esc(name?.split(' ')[0] || 'there');
  const takeawayRows = keyTakeaways.map((t) => summaryRow('', esc(t))).join('');
  const stepRows = nextSteps.map((s) => summaryRow('', esc(s))).join('');

  return {
    subject: `Your coaching session summary`,
    html: brandedEmailLayout({
      preheader: `Here is what Sage captured from your last session.`,
      eyebrow: 'Coaching Session Recap',
      heading: `Session recap, ${firstName}.`,
      recipient: email,
      content:
        p(`Hi ${firstName},`) +
        p(esc(summary)) +
        (keyTakeaways.length > 0
          ? p('<strong>Key takeaways</strong>') + summaryBox(takeawayRows)
          : '') +
        (nextSteps.length > 0
          ? p('<strong>Next steps</strong>') + summaryBox(stepRows)
          : '') +
        goldButton('Continue with Sage', `${APP_URL}/coach`),
    }),
  };
}

// ═══ GOAL REMINDER EMAIL ═══
export function goalReminderEmail(
  name: string,
  goals: string[],
  daysSinceActive: number,
  email = ''
) {
  const firstName = esc(name?.split(' ')[0] || 'there');
  const dayText = daysSinceActive === 1 ? 'yesterday' : `${daysSinceActive} days ago`;
  const goalRows = goals.map((g) => summaryRow('', esc(g))).join('');

  return {
    subject: `${firstName}, your coach is waiting`,
    html: brandedEmailLayout({
      preheader: `Last session was ${dayText}. A few minutes with Sage keeps momentum going.`,
      eyebrow: 'Keep the momentum',
      heading: `Still building, ${firstName}?`,
      recipient: email,
      content:
        p(`Hi ${firstName},`) +
        p(`Your last coaching session was ${dayText}. The leaders who compound fastest are the ones who keep showing up.`) +
        (goals.length > 0
          ? p('<strong>Your active goals</strong>') + summaryBox(goalRows)
          : '') +
        p('A quick 5-minute session with Sage can get you back on track.') +
        goldButton('Resume Coaching', `${APP_URL}/coach`),
    }),
  };
}

// ═══ NEWSLETTER TEMPLATE ═══
// The send-newsletter task passes raw HTML content - this wraps it in
// the branded shell so every broadcast matches the system look.
export function newsletterTemplate(
  subject: string,
  content: string,
  firstName = '',
  email = ''
) {
  const greeting = firstName ? `Hi ${esc(firstName)},` : 'Hi there,';
  return {
    subject,
    html: brandedEmailLayout({
      preheader: subject,
      eyebrow: 'The Rise Letter',
      heading: subject,
      recipient: email,
      content: p(greeting) + content,
    }),
  };
}
