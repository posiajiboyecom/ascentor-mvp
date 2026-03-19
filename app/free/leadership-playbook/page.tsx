import LeadMagnetPage from '@/components/LeadMagnetPage';

export const metadata = {
  title: 'The 90-Day Leadership Playbook — Free Download | Ascentor',
  description: 'The exact framework Sage uses. Set one goal. Track 13 weekly actions. Make your progress visible to the people who decide your future. Free PDF.',
};

export default function LeadershipPlaybookPage() {
  return (
    <LeadMagnetPage
      magnetId="leadership-playbook"
      headline="The 90-Day Leadership Playbook"
      subheadline="The exact system Sage uses — now in your hands."
      description="Set one goal. Follow 13 weekly actions. Make your progress visible to the people who decide your future. This is the framework that every Sage coaching session is built on — and it works without the AI too."
      persona="Builder · Climber"
      type="Free PDF Guide · 12 pages"
      ctaLabel="Get the Free Playbook →"
      successPath="/free/leadership-playbook/download"
      bullets={[
        { text: 'The goal-setting formula — how to write a 90-day goal specific enough to be useful' },
        { text: 'Stakeholder mapping — identify every person whose opinion matters for your goal' },
        { text: '13 weekly actions — one primary move per week, with context on why it matters' },
        { text: 'Four fill-in worksheets to make it a working document, not just reading material' },
        { text: 'The 90-day review — structured debrief that compounds your learning over time' },
      ]}
    />
  );
}
