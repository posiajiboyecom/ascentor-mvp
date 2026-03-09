import { task } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { welcomeEmail } from "./emails/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

async function addToResendAudience(email: string, name: string) {
  const audienceId = process.env.RESEND_AUDIENCE_ID;
  if (!audienceId) {
    console.warn("RESEND_AUDIENCE_ID not set — skipping audience sync");
    return;
  }

  const firstName = name?.split(" ")[0] || "";
  const lastName = name?.split(" ").slice(1).join(" ") || "";

  const res = await fetch(
    `https://api.resend.com/audiences/${audienceId}/contacts`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
        unsubscribed: false,
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    // 409 = contact already exists — not an error worth throwing
    if (res.status !== 409) {
      console.error(`Failed to add ${email} to Resend audience:`, body);
    }
  } else {
    console.log(`Added ${email} to Resend audience`);
  }
}

export const sendWelcomeEmail = task({
  id: "send-welcome-email",
  run: async (payload: { email: string; name: string; userId: string }) => {
    const { email, name } = payload;
    const template = welcomeEmail(name);

    // Send welcome email and sync to newsletter audience in parallel
    const [emailResult] = await Promise.allSettled([
      resend.emails.send({
        from: "Ascentor <hello@ascentorbi.com>",
        to: email,
        subject: template.subject,
        html: template.html,
      }),
      addToResendAudience(email, name),
    ]);

    if (emailResult.status === "rejected") {
      console.error("Welcome email failed:", emailResult.reason);
      throw new Error(`Failed to send welcome email: ${emailResult.reason}`);
    }

    const { data, error } = emailResult.value;

    if (error) {
      console.error("Welcome email failed:", error);
      throw new Error(`Failed to send welcome email: ${error.message}`);
    }

    console.log(`Welcome email sent to ${email}`, data);
    return { success: true, emailId: data?.id };
  },
});
