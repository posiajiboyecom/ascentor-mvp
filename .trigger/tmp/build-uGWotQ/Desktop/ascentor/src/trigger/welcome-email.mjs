import {
  Resend
} from "../../../../chunk-LKXYC37J.mjs";
import {
  task
} from "../../../../chunk-SGGS4MSR.mjs";
import "../../../../chunk-EOLRM24S.mjs";
import {
  welcomeEmail
} from "../../../../chunk-3DJJ3FBG.mjs";
import {
  __name,
  init_esm
} from "../../../../chunk-4QJE3SM7.mjs";

// src/trigger/welcome-email.ts
init_esm();
var resend = new Resend(process.env.RESEND_API_KEY);
var sendWelcomeEmail = task({
  id: "send-welcome-email",
  run: /* @__PURE__ */ __name(async (payload) => {
    const { email, name } = payload;
    const template = welcomeEmail(name);
    const { data, error } = await resend.emails.send({
      from: "Ascentor <onboarding@resend.dev>",
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
