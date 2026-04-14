import {
  welcomeEmail
} from "../../../../chunk-XMG42UWX.mjs";
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

// src/trigger/welcome-email.ts
init_esm();
var resend = new Resend(process.env.RESEND_API_KEY);
async function addToResendAudience(email, name) {
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
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        email,
        first_name: firstName,
        last_name: lastName,
        unsubscribed: false
      })
    }
  );
  if (!res.ok) {
    const body = await res.text();
    if (res.status !== 409) {
      console.error(`Failed to add ${email} to Resend audience:`, body);
    }
  } else {
    console.log(`Added ${email} to Resend audience`);
  }
}
__name(addToResendAudience, "addToResendAudience");
var sendWelcomeEmail = task({
  id: "send-welcome-email",
  run: /* @__PURE__ */ __name(async (payload) => {
    const { email, name } = payload;
    const template = welcomeEmail(name);
    const [emailResult] = await Promise.allSettled([
      resend.emails.send({
        from: "Ascentor <hello@ascentorbi.com>",
        to: email,
        subject: template.subject,
        html: template.html
      }),
      addToResendAudience(email, name)
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
  }, "run")
});
export {
  sendWelcomeEmail
};
//# sourceMappingURL=welcome-email.mjs.map
