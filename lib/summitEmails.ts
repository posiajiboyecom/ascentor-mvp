import { summitMailer } from './nodemailer';

export async function sendRegistrationReceivedEmail(to: string, fullName: string) {
  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to,
    subject: 'We received your Elevation Summit registration',
    html: `
      <p>Hi ${fullName},</p>
      <p>We have received your registration for the Elevation Summit, 19 November 2026, Lagos.</p>
      <p>Your spot is not yet confirmed. Complete payment to secure your place.</p>
    `,
  });
}

export async function sendPaymentConfirmedEmail(to: string, fullName: string, attendanceType?: string) {
  const isVirtual = attendanceType === 'virtual';
  // The Zoom link is created and shared manually by the organizers,
  // not injected from an env var. If this is ever automated, a
  // per-event or per-registration link store would be needed instead.
  const attendanceBlock = isVirtual
    ? `<p>Your Zoom link for the virtual session will be shared with you separately closer to the event date. Keep an eye on your inbox.</p>`
    : `<p>Venue details will follow closer to the event date.</p>`;
  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to,
    subject: 'Your Elevation Summit registration is confirmed',
    html: `
      <p>Hi ${fullName},</p>
      <p>Your payment has been received and your ${isVirtual ? 'virtual' : 'onsite'} place at the Elevation Summit, 19 November 2026${isVirtual ? '' : ', Lagos'}, is confirmed.</p>
      ${attendanceBlock}
      <p>We look forward to seeing you there.</p>
    `,
  });
}

export async function sendAdminPaymentNotification(fullName: string, email: string, organisation: string) {
  await summitMailer.sendMail({
    from: process.env.SUMMIT_MAIL_FROM,
    to: process.env.ADMIN_EMAIL,
    subject: `Paid registration confirmed: ${fullName}`,
    html: `
      <p>A new paid registration has been confirmed.</p>
      <ul>
        <li>Name: ${fullName}</li>
        <li>Email: ${email}</li>
        <li>Company: ${organisation}</li>
      </ul>
    `,
  });
}
