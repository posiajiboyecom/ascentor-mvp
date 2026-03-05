import { task } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { welcomeEmail } from "./emails/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendWelcomeEmail = task({
  id: "send-welcome-email",
  run: async (payload: { email: string; name: string; userId: string }) => {
    const { email, name } = payload;
    const template = welcomeEmail(name);

    const { data, error } = await resend.emails.send({
      from: "Ascentor <hello@ascentorbi.com>",
      to: email,
      subject: template.subject,
      html: template.html,
    });

    if (error) {
      console.error("Welcome email failed:", error);
      throw new Error(`Failed to send welcome email: ${error.message}`);
    }

    console.log(`Welcome email sent to ${email}`, data);
    return { success: true, emailId: data?.id };
  },
});
