import LeadMagnetPage from '@/components/LeadMagnetPage';

export const metadata = {
  title: "Why Talented People Don't Get Promoted — Free Guide | Ascentor",
  description: 'The 3 real reasons promotions go to less talented people — and the 5 specific moves that change the outcome. Free PDF guide.',
};

export default function PromotionBlueprintPage() {
  return (
    <LeadMagnetPage
      magnetId="promotion-blueprint"
      headline="Why Talented People Don't Get Promoted"
      subheadline="The 3 real reasons. The 5 specific moves that change the outcome."
      description="If you have delivered consistently and still been passed over — this is for you. Not motivation. Not general advice. The specific, named reasons this happens and what to do about each one."
      persona="Builder stage"
      type="Free PDF Guide · 8 pages"
      ctaLabel="Get the Free Guide →"
      successPath="/free/promotion-blueprint/download"
      bullets={[
        { text: 'Reason 1: Your work is invisible — and the three moves that fix it' },
        { text: 'Reason 2: You are optimising for the wrong thing — what organisations actually look for when deciding on senior roles' },
        { text: 'Reason 3: You are not in the room — how promotion decisions actually get made and how to change that' },
        { text: 'A before/after comparison showing exactly what changes when you apply these moves' },
        { text: 'The 5 moves summarised — with a "start this week" action for each one' },
      ]}
    />
  );
}
