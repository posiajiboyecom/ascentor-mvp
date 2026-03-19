import DownloadPage from '@/components/DownloadPage';

export const metadata = {
  title: 'Download Your Leadership Playbook | Ascentor',
};

export default function PlaybookDownloadPage() {
  return (
    <DownloadPage
      title="The 90-Day Leadership Playbook"
      downloadUrl={process.env.NEXT_PUBLIC_LM_PLAYBOOK_URL || '/free/leadership-playbook'}
      fileName="Ascentor-90-Day-Leadership-Playbook.pdf"
      nextStep="The playbook gives you the framework. Sage runs it with you — remembering your goal, asking the right questions at the right moment, and adapting to your specific situation."
      nextStepLink="/signup"
      nextStepLabel="Try Sage free for 7 days →"
    />
  );
}
