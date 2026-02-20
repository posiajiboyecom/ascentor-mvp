import { task } from "@trigger.dev/sdk/v3";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY!);

export const sendNewsletter = task({
  id: "send-newsletter",
  retry: { maxAttempts: 3 },
  run: async (payload: { subject: string; content: string; sentBy: string }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: subscribers } = await supabase
      .from("newsletter_subscribers")
      .select("email, first_name")
      .eq("is_active", true);

    if (!subscribers || subscribers.length === 0) {
      console.log("No active subscribers");
      return { sent: 0, failed: 0 };
    }

    console.log(`Sending newsletter to ${subscribers.length} subscribers`);

    let sent = 0;
    let failed = 0;
    const batchSize = 10;

    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (sub: any) => {
          try {
            const personalizedHTML = payload.content.replace(
              /\{\{first_name\}\}/g,
              sub.first_name || "Leader"
            );

            await resend.emails.send({
              from: "Ascentor <hello@ascentorbi.com>",
              to: sub.email,
              subject: payload.subject,
              html: personalizedHTML,
            });
            sent++;
          } catch (err) {
            console.error(`Failed to send to ${sub.email}:`, err);
            failed++;
          }
        })
      );

      if (i + batchSize < subscribers.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    console.log(`Newsletter done: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  },
});
