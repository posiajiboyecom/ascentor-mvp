'use client';

// Help centre: topic chips, FAQ accordion and the contact form. The form posts to the existing /api/contact route.

import { useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { useToast } from '@/components/rx/Toast';

export const FAQ: [string, string, string][] = [
  ['Circle', 'What happens in my Circle?', 'You join a small Circle for a 90-day cycle. You meet every week, share a short report and help each other keep your practices.'],
  ['Circle', 'Are Circle calls audio or video?', 'Every call starts as audio. Anyone can turn their camera on during the call. A call starts when 60% of the Circle has joined.'],
  ['Mentorship', 'How does Circle mentorship work?', 'Your Circle votes for a mentor and your facilitator confirms. You book sessions from the mentor’s free times. A session only starts once your Circle’s agenda is ready.'],
  ['Billing', 'When will I be charged?', 'Every plan starts with 7 days free. You add a card when you choose Seeker or Builder, and the first charge is on day 8. Cancel before then and you pay nothing. After that you are charged each month or year, and if you cancel you keep access until the end of the period you paid for.'],
  ['Billing', 'What is light access?', 'If a payment fails, you keep full access for 7 days while we retry your card. If it still isn’t paid, you move to light access: you keep Today, your growth record, the Open house group and direct messages, while Sage, Circle chat, mentor sessions and Learn pause until you pay.'],
  ['Billing', 'Why are prices in US dollars?', 'Members in Nigeria pay in naira. Everywhere else, plans are billed in US dollars: Seeker is $5 a month or $50 a year, and Builder is $10 a month or $100 a year. We set this from where you are when you subscribe, and your plan keeps that currency after that, even if you travel. Group prices are for members paying in naira.'],
  ['Sage', 'Who can see what I tell Sage?', 'Your Circle, facilitator and mentor never see your Sage conversations. The Ascentor team can read and analyse conversations on Ascentor, including Sage, to improve the service and keep members safe, as our privacy policy explains. You can see and delete what Sage remembers in Settings.'],
  ['Safety', 'How do I report someone?', 'Open the conversation, post or meetup and choose Report. Our safety team reviews every report.'],
  ['Account', 'I can’t sign in', 'Use Forgot password on the sign-in page. If you joined with Google or Apple, use that button instead.'],
];
const CATS = ['All', 'Circle', 'Mentorship', 'Billing', 'Sage', 'Safety', 'Account'];
const TOPICS = ['My account or sign-in', 'Billing and plans', 'An order from the shop', 'My Circle or mentor', 'Safety concern', 'Something else'];

export function HelpMain({ name, email }: { name: string; email: string | null }) {
  const toast = useToast();
  const [cat, setCat] = useState('All');
  const [open, setOpen] = useState('');
  const [find, setFind] = useState('');
  const [topic, setTopic] = useState(TOPICS[0]);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const faqs = useMemo(() => {
    const f = find.trim().toLowerCase();
    return FAQ.filter((x) => (cat === 'All' || x[0] === cat) && (!f || x[1].toLowerCase().includes(f) || x[2].toLowerCase().includes(f)));
  }, [cat, find]);

  async function send() {
    if (busy) return;
    if (!message.trim()) { toast('Tell us what happened first.'); return; }
    if (!email) { toast('Add an email to your account first, then try again.'); return; }
    setBusy(true);
    try {
      const res = await fetch('/api/contact', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, subject: topic, message: message.trim() }),
      });
      if (!res.ok) throw new Error('failed');
      setMessage('');
      toast('Sent. We reply within 2 to 3 business days.');
    } catch { toast('We couldn’t send that. Please try again.'); }
    setBusy(false);
  }

  return (
    <div className="rx-stack-lg">
      <label className="rx-search">
        <Search aria-hidden />
        <input placeholder="Search help" aria-label="Search help" value={find} onChange={(e) => setFind(e.target.value)} />
      </label>
      <div className="rx-opts rx-tabs" role="group" aria-label="Topics">
        {CATS.map((c) => <button key={c} type="button" className={`rx-opt${cat === c ? ' on' : ''}`} aria-pressed={cat === c} onClick={() => setCat(c)}>{c}</button>)}
      </div>
      <div className="rx-card" style={{ padding: '4px 16px' }}>
        {faqs.map((x) => {
          const isOpen = open === x[1];
          return (
            <div key={x[1]} className="rx-faq">
              <button type="button" className="rx-rowlink" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : x[1])}>
                <span className="rt"><span className="t" style={{ whiteSpace: 'normal' }}>{x[1]}</span></span>
                <ChevronDown aria-hidden className={`chev${isOpen ? ' up' : ''}`} />
              </button>
              {isOpen && <p className="rx-faqA rx-rise">{x[2]}</p>}
            </div>
          );
        })}
        {faqs.length === 0 && <p className="rx-sm" style={{ padding: '16px 4px' }}>Nothing matches that. Send us a message below.</p>}
      </div>
      <div className="rx-card rx-stack">
        <p className="rx-label">Contact support</p>
        <div className="rx-fld"><label htmlFor="hct">Topic</label>
          <select id="hct" className="rx-in" value={topic} onChange={(e) => setTopic(e.target.value)}>{TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
        </div>
        <div className="rx-fld"><label htmlFor="hcm">Message</label>
          <textarea id="hcm" className="rx-in" placeholder="Tell us what happened" value={message} maxLength={4000} onChange={(e) => setMessage(e.target.value)} />
        </div>
        <div><button type="button" className="rx-btn primary" disabled={busy} onClick={send}>Send</button></div>
      </div>
    </div>
  );
}
