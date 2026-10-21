# Visual pass

Opens every new or changed screen at desktop (1440px) and mobile (390px), saves screenshots to `docs/screenshots/`, and
reports console errors, failed requests, horizontal overflow and error text. Uses Playwright (`npx playwright install chromium` once).

1. Start the app (`npm run dev`) with the mail sink or real SMTP as needed.
2. `node scripts/visual/visual_fixtures.cjs up` creates a throwaway member, a throwaway admin and five `ZZ` shop products
   (all marked `@ascentor-test.invalid` / `zz-`) in the database named in `.env.local`, and writes `visual_state.json` next to it.
3. `node scripts/visual/visual_pass.cjs [public] [member] [plan] [admin]` (default all). `ONLY=name1,name2` re-shoots named screens,
   `WAIT=4500` waits longer per page (the public site shows a splash on a fresh visit).
4. `node scripts/visual/visual_fixtures.cjs down` removes everything it created. `visual_fixtures.cjs plan <plan> <status> <days>` sets the
   test member's plan to view the Plan screen in each billing state.

It writes to the real database in `.env.local`: run it only against a database you are happy to add and remove test rows in.
