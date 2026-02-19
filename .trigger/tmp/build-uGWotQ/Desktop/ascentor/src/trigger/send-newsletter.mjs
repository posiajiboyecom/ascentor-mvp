import {
  createClient,
  dist_exports
} from "../../../../chunk-RJI2ETH6.mjs";
import {
  Resend
} from "../../../../chunk-LKXYC37J.mjs";
import {
  task
} from "../../../../chunk-SGGS4MSR.mjs";
import "../../../../chunk-EOLRM24S.mjs";
import {
  newsletterEmail
} from "../../../../chunk-3DJJ3FBG.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-4QJE3SM7.mjs";

// src/trigger/send-newsletter.ts
init_esm();
var resend = new Resend(process.env.RESEND_API_KEY);
var supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
var sendNewsletter = task({
  id: "send-newsletter",
  run: /* @__PURE__ */ __name(async (payload) => {
    const { subject, content, sentBy } = payload;
    const { data: subscribers, error: fetchError } = await supabase.from("newsletter_subscribers").select("email, first_name").eq("is_active", true);
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
    const errors = [];
    const batchSize = 10;
    for (let i = 0; i < subscribers.length; i += batchSize) {
      const batch = subscribers.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async (sub) => {
          const template = newsletterEmail(subject, content, sub.first_name || void 0);
          return resend.emails.send({
            from: "Ascentor <hello@ascentorbi.com>",
            to: sub.email,
            subject: template.subject,
            html: template.html
          });
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled" && !result.value.error) {
          sent++;
        } else {
          failed++;
          const errMsg = result.status === "rejected" ? result.reason?.message : result.value?.error?.message;
          errors.push(errMsg || "Unknown error");
        }
      }
      if (i + batchSize < subscribers.length) {
        await new Promise((r) => setTimeout(r, 1e3));
      }
    }
    console.log(`Newsletter done: ${sent} sent, ${failed} failed`);
    return {
      success: true,
      sent,
      failed,
      total: subscribers.length,
      errors: errors.slice(0, 5),
      // Only first 5 errors
      sentBy
    };
  }, "run")
});
export {
  sendNewsletter
};
//# sourceMappingURL=send-newsletter.mjs.map
