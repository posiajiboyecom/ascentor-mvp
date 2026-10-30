# Summit ticket-email delivery (Admin > Elevation Summit > Registrations > Delivery)

Open **Admin > Elevation Summit > Registrations**, then the **Delivery and resend all** button (or go to `/admin/c/registrations/delivery`).

- **Tiles:** Confirmed, Sent, Not sent, Failed, Unknown. Only confirmed registrations are listed (they are the ones owed a ticket).
- **Tabs and search:** All, Sent, Not sent, Failed; search by name or email.
- **Per row:** name, email, status, attempts, last attempt time, last error in plain words, and **Resend this one**.
- **Export CSV:** exports the current tab and search (needs the Full level on Registrations).
- **Resend all unsent:** one press. The page sends a few at a time (4 per round, spaced 1.5 s apart) and keeps going until nobody is left, with a progress bar ("38 of 43 sent"). **Pause** stops after the current round; **Resume** carries on. It stops by itself, with a plain message, at a mailbox login failure, a refused From address, an unreachable mail server, or when several tickets in a row fail.
- **Closing the page is safe.** Everything is kept in the database. Press the button again and it carries on with whoever is still unsent. Each person is claimed before sending, so two presses, two tabs or two admins never send two emails to one person.

## What the statuses mean
- **Sent:** our mail server accepted the message. It does not prove the inbox accepted it. A bad address comes back to the sending mailbox as a separate bounce email, which the app cannot read.
- **Not sent:** nothing has been tried yet. **Failed:** the last try failed (the reason is in the row). **Unknown:** a send is in progress, or started and never reported back; it is picked up again after 5 minutes.
- After a login failure the server will not try to log in again for 2 minutes (to protect the mailbox from a lockout). After fixing the password, redeploy (or wait 2 minutes) before pressing Resend.

No database change: this uses the `confirmation_email_*` columns that the earlier hotfix migration already added.

## Tested locally (against a local mail sink, not real mail)
Full run (9 of 9, one email each), pause and resume, two tabs pressing at once, page reload mid-run, a login failure stop and recovery, and a double click on one row. Script: `scripts/visual/delivery_e2e.cjs` with `scripts/visual/smtp_sink.cjs`.
