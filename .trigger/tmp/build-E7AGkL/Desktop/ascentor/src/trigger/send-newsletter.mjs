import {
  Resend
} from "../../../../chunk-4NS42XCJ.mjs";
import {
  task
} from "../../../../chunk-ZHF6YW46.mjs";
import "../../../../chunk-7QMGN3HH.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-UQUWQY52.mjs";

// src/trigger/send-newsletter.ts
init_esm();
var resend = new Resend(process.env.RESEND_API_KEY);
async function buildRecipientList() {
  const { createClient } = await import("../../../../dist-H5SWDOEE.mjs");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  const [newsletterResult, usersResult] = await Promise.allSettled([
    supabase.from("newsletter_subscribers").select("email, first_name").eq("is_active", true),
    supabase.from("profiles").select("email, full_name")
  ]);
  const recipients = /* @__PURE__ */ new Map();
  if (newsletterResult.status === "fulfilled" && newsletterResult.value.data) {
    for (const sub of newsletterResult.value.data) {
      if (sub.email) {
        recipients.set(sub.email.toLowerCase(), {
          email: sub.email,
          first_name: sub.first_name || ""
        });
      }
    }
    console.log(`Newsletter subscribers: ${newsletterResult.value.data.length}`);
  } else {
    console.warn("Could not fetch newsletter_subscribers:", newsletterResult);
  }
  if (usersResult.status === "fulfilled" && usersResult.value.data) {
    for (const user of usersResult.value.data) {
      if (user.email && !recipients.has(user.email.toLowerCase())) {
        recipients.set(user.email.toLowerCase(), {
          email: user.email,
          first_name: user.full_name?.split(" ")[0] || ""
        });
      }
    }
    console.log(`App users fetched: ${usersResult.value.data.length}`);
  } else {
    console.warn("Could not fetch app users:", usersResult);
  }
  const list = Array.from(recipients.values());
  console.log(`Total unique recipients after merge: ${list.length}`);
  return list;
}
__name(buildRecipientList, "buildRecipientList");
var sendNewsletter = task({
  id: "send-newsletter",
  retry: { maxAttempts: 3 },
  run: /* @__PURE__ */ __name(async (payload) => {
    const recipients = await buildRecipientList();
    if (recipients.length === 0) {
      console.log("No recipients found");
      return { sent: 0, failed: 0 };
    }
    console.log(`Sending newsletter to ${recipients.length} recipients`);
    let sent = 0;
    let failed = 0;
    const batchSize = 10;
    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      await Promise.all(
        batch.map(async (recipient) => {
          try {
            const personalizedHTML = payload.content.replace(
              /\{\{first_name\}\}/g,
              recipient.first_name || "there"
            );
            await resend.emails.send({
              from: "Ascentor <hello@ascentorbi.com>",
              to: recipient.email,
              subject: payload.subject,
              html: personalizedHTML
            });
            sent++;
          } catch (err) {
            console.error(`Failed to send to ${recipient.email}:`, err);
            failed++;
          }
        })
      );
      if (i + batchSize < recipients.length) {
        await new Promise((r) => setTimeout(r, 1e3));
      }
    }
    console.log(`Newsletter done: ${sent} sent, ${failed} failed`);
    return { sent, failed, total: recipients.length };
  }, "run")
});
export {
  sendNewsletter
};
//# sourceMappingURL=send-newsletter.mjs.map
