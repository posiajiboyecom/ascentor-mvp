// scripts/test-email.ts
// Checks the email setup from your own machine, using the SMTP settings in .env.local.
//
//   npx tsx scripts/test-email.ts --verify          connect and log in to the mail server, send nothing
//   npx tsx scripts/test-email.ts you@example.com   send one test notification email to that address
//
// It never prints the password.
import { config } from 'dotenv';

config({ path: '.env.local' });

async function main() {
  const { getMailer, mailerInfo, sendEmail } = await import('../lib/nodemailer');
  const { brandedEmailLayout, esc, p, goldButton } = await import('../lib/emailTemplate');
  const info = mailerInfo();
  console.log(`server  ${info.host}:${info.port}`);
  console.log(`mailbox ${info.user ?? '(not set)'}`);
  console.log(`from    ${info.from}`);
  if (!info.configured) { console.error('SMTP_USER and SMTP_PASS are not both set in .env.local.'); process.exit(1); }

  const arg = process.argv[2];
  if (!arg || arg === '--verify') {
    await getMailer()!.verify();
    console.log('OK: connected and logged in to the mail server.');
    return;
  }
  const html = brandedEmailLayout({
    preheader: 'This is a test of Ascentor notification email.',
    eyebrow: 'Community',
    heading: 'Amaka commented on your post',
    recipient: arg,
    content: p(esc('“Great work. Which lab was it?”')) + goldButton('Open in Ascentor', 'https://joinascentor.com/community'),
  });
  await sendEmail({ to: arg, subject: 'Ascentor test: Amaka commented on your post', html });
  console.log(`OK: sent a test email to ${arg}. Check the inbox and the spam folder.`);
}

main().catch((e) => { console.error('FAILED:', e instanceof Error ? e.message : e); process.exit(1); });
