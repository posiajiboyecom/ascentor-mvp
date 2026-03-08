import {
  welcomeEmail
} from "../../../../chunk-XMG42UWX.mjs";
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

// src/trigger/welcome-email.ts
init_esm();
var resend = new Resend(process.env.RESEND_API_KEY);
var sendWelcomeEmail = task({
  id: "send-welcome-email",
  run: /* @__PURE__ */ __name(async (payload) => {
    const { email, name } = payload;
    const template = welcomeEmail(name);
    const { data, error } = await resend.emails.send({
      from: "Ascentor <hello@ascentorbi.com>",
      to: email,
      subject: template.subject,
      html: template.html
    });
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
