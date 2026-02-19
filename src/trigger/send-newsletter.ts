import { task } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";
import { createClient } from "@supabase/supabase-js";
import { newsletterEmail } from "./emails/email-templates";

const resend = new Resend(process.env.RESEND_API_KEY);

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const sendNewsletter = task({
  id: "send-newsletter",
  run: async (payload: { subject: string; content: string; sentBy: string }) => {
    const { subject, content, sentBy } = payload;

    // Fetch all active subscribers
    const { data: subscribers, error: fetchError } = await supabase
      .from("newsletter_subscribers")
      .select("email, first_name")
      .eq("is_active", true);

    if (fetchError) {
      throw new Error(`Failed to fetch subscribers: ${fetchError.message}`);
    }

    if (!subscribers || subscribers.length === 0) {
      console.log("No active subscribers found");
      return { success: true, sent: 0, total: 0 };
    }

    console.log(`Sending newsletter to ${subscribers.length} subscribers`);

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send in batches of 10 to respect rate limits
    const batchSize = 10;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map(async (sub) => {
          const template = newsletterEmail(subject, content, sub.first_name || undefined);
          return resend.emails.send({
            from: "Ascentor <hello@ascentorbi.com>",
            to: sub.email,
            subject: template.subject,
            html: template.html,
          });
        })
      );

      for (const result of results) {
        if (result.status === "fulfilled" && !result.value.error) {
          sent++;
        } else {
          failed++;
          const errMsg = result.status === "rejected"
            ? result.reason?.message
            : result.value?.error?.message;
          errors.push(errMsg || "Unknown error");
        }
      }

      // Small delay between batches
      if (i + batchSize < subscribers.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    console.log(`Newsletter done: ${sent} sent, ${failed} failed`);

    return {
      success: true,
      sent,
      failed,
      total: subscribers.length,
      errors: errors.slice(0, 5), // Only first 5 errors
      sentBy,
    };
  },
});
