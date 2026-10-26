# SEO changes (branch feat/seo-admin-mobile)

Source: the "Ascentor SEO + AI-Search Fix Kit" (audit of 23 Oct 2026). "Before" is `origin/main` at the start of the work; "after" was read from a production build served locally (`next build`, `next start`).

## Metadata, before and after

| Page | Field | Before | After |
|---|---|---|---|
| `/` | title | Ascentor, Build a life that outlasts you. | Ascentor \| Mentorship & Leadership for Young Africans |
| | description | Ascentor is the platform of The Elevation Summit, a global community of purposeful individuals building lives of meaning, leadership, and lasting impact. | Ascentor is a mentorship and leadership development platform for ambitious young Africans: small Circles, human mentors, and Sage, an AI coach. |
| | canonical | `/` | `https://joinascentor.com` |
| | og:title | Ascentor, The Elevation Summit Platform | Ascentor \| Mentorship & Leadership for Young Africans |
| | og:description | Join a global community of purposeful individuals. The official platform of The Elevation Summit movement. | same as description |
| | og:image | default generated image | default generated image (`/opengraph-image`) |
| `/movement` | title | The Movement \| Ascentor | The Movement: Building the Total Person \| Ascentor |
| | description | A generation is drifting. Ascentor and The Elevation Summit exist to change that. Discover the ideology, the conviction, and the vision behind the movement. | Why a generation is drifting and how Ascentor builds the total person across six dimensions: Mind, Character, Vocation, Relationships, Community, Legacy. |
| | canonical | **`/` (the homepage: told Google to ignore the page)** | `https://joinascentor.com/movement` |
| | og:title / description / url | the homepage's | the Movement page's own |
| `/about` | title | About Ascentor \| Ascentor | About Ascentor and Its Founder, Posi Ajiboye \| Ascentor |
| | description | Ascentor (formerly AscentorBI) is a purposeful living and leadership development platform: AI coaching with Sage, community in The Circle, expert sessions, and The Elevation Summit, its annual gathering in Lagos. (already present) | Ascentor is a mentorship and leadership development platform founded in Lagos by Posi Ajiboye, built on the conviction that purpose is built, not found. |
| | canonical | `https://joinascentor.com/about` (already present) | `https://joinascentor.com/about` |
| | og:image | CMS founder photo | default generated image (the metadata is now static so it sits in `<head>`; see note 2) |
| `/elevation-summit` | title | The Elevation Summit 2026, Lagos \| Physical & Virtual \| Ascentor | The Elevation Summit 2026: 19 November, Lagos and Online \| Ascentor |
| | description | ...19 November 2026 at the Aderemi Makanjuola **Lecture Theatre**... | Free one-day summit on 19 Nov 2026 at Lagos State University, with global virtual access. Theme: The Rise We Choose. See speakers and register. |
| | og:description / twitter:description | **"December 2026"** | same as description (19 Nov) |
| | og:image / twitter:image | **none** | `https://joinascentor.com/images/elevation-summit-flyer-v3.jpg` |
| `/faq` | all | page did not exist | new page, FAQPage schema, all answers in the HTML |

Site-wide: the root layout no longer sets canonical, openGraph, twitter or description (it set canonical `/` and the homepage og for every page). Viewport no longer blocks zoom (`maximum-scale=1`, `user-scalable=no` removed). `twitter:site` is `@joinascentor`.

## Other changes
- **Founder name:** displayed as "Posi Ajiboye" everywhere (movement page, about default, admin default, meta author). "Ajiboye Ayomiposi Samuel" is only the Person schema `alternateName`. The stray leading apostrophe stored in the CMS is stripped when rendering (stored text untouched, see `docs/loose-ends.md`).
- **JSON-LD (root):** Organization (logo `/icon/icon-512.png`, a 512x512 PNG that already existed), Person (founder), WebSite, plus the existing SoftwareApplication. Event only on `/elevation-summit` (free, NGN 0, hybrid, start 2026-11-19 10:00 WAT, no end time until the programme end is fixed). FAQPage only on `/faq`.
- **robots.txt:** disallows `/api/` and `/admin` plus the member and auth routes; no crawler is singled out, so GPTBot, ClaudeBot, PerplexityBot, Google-Extended and Bingbot are allowed; lists the sitemap.
- **sitemap.xml:** public pages only. Removed URLs that redirect (`/how-it-works`, `/who-its-for`, `/mentor-apply`), `/signup`, and `/events` (no page). Added `/faq`, `/donate`, `/newsletter`.
- **llms.txt:** from the kit. The kit's link to `/community` was replaced by `/faq`, because `/community` is the logged-in member area.
- **Homepage:** answer-first block under the hero, "How it works" section (Circles, Mentors, Sage an AI coach, the Learn library, Sessions), hero eyebrow and subtext now describe Ascentor first.
- **Summit page:** "72 hours" removed, venue wording unified to "Aderemi Makanjuola Hall", FAQ answers always in the HTML (hidden until opened), gallery has one server-rendered copy of each of its 30 photos with its own alt text (the scrolling loop copies are added in the browser and hidden from screen readers), speaker photos have "name, role" alt text.
- **vercel.json:** duplicated `redirects` key removed (in PR #37).

## Validation (production build, local)
- Every page returns 200. All JSON-LD blocks parse as JSON. Types: `/` and `/movement` Organization, Person, WebSite, SoftwareApplication; `/about` adds AboutPage; `/elevation-summit` adds Event and BreadcrumbList; `/faq` adds FAQPage.
- Lighthouse (local, headless): SEO 100 on `/`, `/movement`, `/about`, `/elevation-summit`, `/faq`. Accessibility 94, 98, 98, 95, 98. Remaining accessibility notes: heading order on all five, and touch-target size on `/` and `/elevation-summit`. Not changed here.

## Notes
1. **Needs confirming (Posi):** the Summit date is now "19 November 2026" on every surface; the kit's own schedule works toward it. Still unsettled by the kit and left as is, marked with `TODO(posi)` in code: "Summit 2.0" vs "Inaugural" (hero, ticket PDF, many lines), the gallery label "From Past Editions", the X handle (`@joinascentor` from the kit, the code used `@ascentorhq`), and the wording of the FAQ answers "Is it free?", "Who are the mentors?" and "How is it different from a networking group?".
2. `/about` metadata was async (it read the founder photo from the CMS), so Next streamed it into the body after `</head>`, which Lighthouse scored 92 for SEO. It is a plain export now. The cost: the share image for `/about` is the default image, not the founder photo.
3. `/privacy`, `/contact`, `/newsletter`, `/careers`, `/partner-apply`, `/waitlist`, `/donate` still carry their own older metadata or none. Not part of the kit; worth a pass with `pageMeta()`.
