# Loose ends (for Posi)

## 1. ascentorbi.com does not resolve
`ascentorbi.com` and `www.ascentorbi.com` return NXDOMAIN (checked with Google DNS), so the 301 in `vercel.json` can never fire: nothing reaches Vercel. Old links and any Google results for the old domain simply fail.

Steps (Posi, with the registrar and Vercel access):
1. At the registrar, check whether `ascentorbi.com` expired. Renew or re-register it. If it is lost to someone else, stop here: nothing can be redirected.
2. Vercel > the Ascentor project > Settings > Domains > Add `ascentorbi.com` and `www.ascentorbi.com`.
3. Set DNS as Vercel shows (an `A` record `76.76.21.21` for the apex, a `CNAME` to `cname.vercel-dns.com` for `www`), or move the nameservers to Vercel.
4. Wait for both domains to show Valid Configuration.
5. Check: `curl -sI https://ascentorbi.com/about` should show `308 Permanent Redirect` with `Location: https://joinascentor.com/about` (Vercel uses 308 for `permanent: true`; Google treats it like a 301). Keep it for at least 12 months.
The redirect rules already exist in `vercel.json` (I removed a duplicated `redirects` key, content unchanged).

## 2. The stray apostrophe in "'Posi Ajiboye"
Location: Supabase table `marketing_sections`, the row with id `d8eb81fc-3502-41c3-9fc6-847e8df84b4e` (the About page, section `founder`). In its JSON the fields `draft_data.name`, `published_data.name`, `draft_data.bio` and `published_data.bio` start with `'`.

One-minute fix: Admin > About (`/admin/about`), Founder section: delete the leading `'` from the Name and from the first line of the Bio, then Publish. The public page already hides it at render time, so nothing looks wrong meanwhile. I did not edit the database.

## 3. Summit date (checked on the production build)
Every surface now says 19 November 2026: page meta description, og and twitter descriptions, hero, stats bar, registration text, FAQ, Event schema (`startDate 2026-11-19T10:00:00+01:00`), `llms.txt`, ticket PDF, confirmation and event-day emails, homepage banner, admin registrations screen. The rendered `/elevation-summit` page contains no "December" or "February".
Remaining mismatches, none visible to the public:
- `lib/supabase/seo.ts` is an unused duplicate of `lib/seo.ts`; it said "December 2026" and "Lecture Theatre" and was corrected to match. It can be deleted.
- Unsettled by the SEO kit and left as written: "Summit 2.0" (headline, ticket PDF) against "Inaugural" (many lines), the "From Past Editions" gallery label, and no programme end time (so the Event schema has no `endDate`).
Please confirm 19 November 2026 is the date.
