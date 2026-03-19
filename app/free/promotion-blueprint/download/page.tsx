import DownloadPage from '@/components/DownloadPage';

export const metadata = {
  title: 'Download Your Promotion Blueprint | Ascentor',
};

export default function PromotionDownloadPage() {
  return (
    <DownloadPage
      title="Why Talented People Don't Get Promoted"
      downloadUrl={'https://awdgbxsojgyryjltumov.supabase.co/storage/v1/object/public/lead-magnets/LM2-Why-Talented-People-Dont-Get-Promoted.pdf'}
      fileName="Ascentor-Why-Talented-People-Dont-Get-Promoted.pdf"
      nextStep="The guide identifies the moves. Sage helps you execute them — starting with the conversation you need to have with your manager and working through every step of the visibility strategy."
      nextStepLink="/signup"
      nextStepLabel="Try Sage free for 7 days →"
    />
  );
}
