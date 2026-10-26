# Email runbook: fix "emails are not being sent"

**Status:** root cause not confirmable from the build machine. The Vercel CLI here is linked to the wrong project (`rexta-admin`) and this account is not authorised for the Ascentor project (`npx vercel projects ls` returns `Not authorized`), and no SMTP login is in any local env file. The last known fault is Hostinger rejecting the mailbox login with a 535 authentication error, and `SMTP_USER` not being `hello@joinascentor.com`. The steps below confirm and fix it. Whoever has Ascentor access on Vercel (Kenny) runs them.

What the code does: every send goes through `sendEmail` in `lib/nodemailer.ts` over SMTP (`smtp.hostinger.com`, port 465). Since this change, every failure writes one log line starting `[email] SEND FAILED` with `kind` (`auth`, `sender`, `connection`, `rejected`, `not_configured`), the server reply and a `fix` hint. It never logs the password. Sign-up and password-reset codes show the member an error with a working "Resend code"; event registration and the waitlist now say when the confirmation email did not go out.

## 1. Reset the mailbox password (Hostinger)
1. hPanel > Emails > Email Accounts > `hello@joinascentor.com` > Change password. Choose a new password and keep it in the password manager.
2. Confirm you can sign in to webmail with it.

## 2. Set the variables (Vercel, the Ascentor project)
Settings > Environment Variables. Set for **Production and Preview**:

| Name | Value |
|---|---|
| `SMTP_HOST` | `smtp.hostinger.com` |
| `SMTP_PORT` | `465` |
| `SMTP_USER` | the **full** sender address, `hello@joinascentor.com` (must match the From address) |
| `SMTP_PASS` | the new mailbox password |
| `EMAIL_FROM` | `Ascentor <hello@joinascentor.com>` |

Leave out any `SUMMIT_GMAIL_*` values: there is no Gmail fallback any more.

## 3. Redeploy
Environment variables are read when the server starts. Deployments > the latest Production deployment > Redeploy (or push a commit). Do the same for the Preview branch you test on.

## 4. Verify
On a machine with the same values in `.env.local` (never commit them):

```
npx tsx scripts/test-email.ts --verify
npx tsx scripts/test-email.ts YOUR_ADMIN_ADDRESS
```
The first connects and logs in without sending. The second sends one test mail to your own address only.

**Send back:** the printed lines `server`, `mailbox`, `from` and the final `OK ...` or `FAILED: <kind> - <message>`. No password. If the script prints `WARNING: SMTP_USER ... is not the From address`, fix `SMTP_USER` first.

If the live site still fails, open Vercel > Logs and search `SEND FAILED`; the `kind` and `fix` fields name the cause.

## When a transactional provider would be worth adding
Add one (Resend or Postmark behind the same `sendEmail`) if mail still lands in spam after the mailbox works, if volume passes what a single Hostinger mailbox allows per hour (broadcasts, Summit reminders), or if the mailbox login keeps failing. The trade-off is one more vendor, DNS records (SPF, DKIM) to add, and a small monthly cost, in return for delivery reports and no dependence on one mailbox.
