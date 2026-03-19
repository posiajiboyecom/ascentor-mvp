import LeadMagnetPage from '@/components/LeadMagnetPage';

export const metadata = {
  title: 'The Salary Negotiation Script Pack — Free Download | Ascentor',
  description: '5 word-for-word scripts for every salary conversation. Copy, adapt, use. Free template pack.',
};

export default function SalaryScriptsPage() {
  return (
    <LeadMagnetPage
      magnetId="salary-scripts"
      headline="The Salary Negotiation Script Pack"
      subheadline="5 word-for-word scripts. Copy. Adapt. Use."
      description="Every salary conversation you will ever need to have — written out for you. Not templates to memorise. Frameworks to adapt. Each script includes the exact words, the psychology behind why they work, and what to do when the other person pushes back."
      persona="Explorer · Builder"
      type="Free Template Pack · 5 scripts"
      ctaLabel="Get the Free Scripts →"
      successPath="/free/salary-scripts/download"
      bullets={[
        { text: 'Script 1: Opening the conversation — when there is no offer on the table yet' },
        { text: 'Script 2: Responding to a low offer — what to say in the first 30 seconds' },
        { text: 'Script 3: The counter-offer — how to name your number and make it land' },
        { text: 'Script 4: Negotiating without leverage — how to ask when you have no competing offer' },
        { text: 'Script 5: Following up after silence — when they said "I\'ll look into it" and went quiet' },
      ]}
    />
  );
}
