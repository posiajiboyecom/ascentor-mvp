import { task } from "@trigger.dev/sdk/v3";
import { sendEmail } from "@/lib/nodemailer";
import { welcomeEmail } from "./emails/email-templates";

export const sendWelcomeEmail = task({
  id: "send-welcome-email",
  run: async (payload: { email: string; name: string; userId: string }) => {
    const { email, name } = payload;
    const template = welcomeEmail(name, email);

    await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
    });

    console.log(`Welcome email sent to ${email}`);
    return { success: true };
  },
});
