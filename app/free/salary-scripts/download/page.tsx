import DownloadPage from '@/components/DownloadPage';

export const metadata = {
  title: 'Download Your Salary Scripts | Ascentor',
};

export default function SalaryDownloadPage() {
  return (
    <DownloadPage
      title="The Salary Negotiation Script Pack"
      downloadUrl={process.env.NEXT_PUBLIC_LM_SALARY_URL || '/free/salary-scripts'}
      fileName="Ascentor-Salary-Negotiation-Script-Pack.pdf"
      nextStep="Want to rehearse one of these conversations before the real thing? Open Ascentor and tell Sage exactly what you are preparing for. Sage will run you through it until you are ready."
      nextStepLink="/signup"
      nextStepLabel="Practise with Sage free →"
    />
  );
}
