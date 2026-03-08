import {
  Resend
} from "../../../../chunk-4NS42XCJ.mjs";
import {
  task
} from "../../../../chunk-MN3LL5E3.mjs";
import "../../../../chunk-7QMGN3HH.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-UQUWQY52.mjs";

// src/trigger/send-newsletter.ts
init_esm();
var resend = new Resend(process.env.RESEND_API_KEY);
var sendNewsletter = task({
  id: "send-newsletter",
  retry: { maxAttempts: 3 },
  run: /* @__PURE__ */ __name(async (payload) => {
    const { createClient } = await import("../../../../dist-H5SWDOEE.mjs");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    const { data: subscribers } = await supabase.from("newsletter_subscribers").select("email, first_name").eq("is_active", true);
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
        batch.map(async (sub) => {
          try {
            const personalizedHTML = payload.content.replace(
              /\{\{first_name\}\}/g,
              sub.first_name || "Leader"
            );
            await resend.emails.send({
              from: "Ascentor <hello@ascentorbi.com>",
              to: sub.email,
              subject: payload.subject,
              html: personalizedHTML
            });
            sent++;
          } catch (err) {
            console.error(`Failed to send to ${sub.email}:`, err);
            failed++;
          }
        })
      );
      if (i + batchSize < subscribers.length) {
        await new Promise((r) => setTimeout(r, 1e3));
      }
    }
    console.log(`Newsletter done: ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }, "run")
});
export {
  sendNewsletter
};
//# sourceMappingURL=send-newsletter.mjs.map
