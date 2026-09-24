# LinkedIn Radar

**Live:** https://radar-transformsmarter.netlify.app (Netlify team "Transform Smarter", site `radar-transformsmarter`). Source: private repo `ganeshariyur-web/linkedin-radar`.

A private web app that scores your LinkedIn **Connections** and **Invitations** against your ideal customer profile, live, using TypeSafe's Jev model. Files are parsed in your browser and never uploaded; only the job title, company name and a few code-computed buckets reach Jev. Results and presets persist in your browser (IndexedDB). No database, no accounts.

- **Radar**: upload, run, watch each row score, inspect any person, filter, download CSVs per tier.
- **Classifier Studio**: rewrite every question Jev is asked, tune thresholds with instant recount, test edits on 25 rows, save and share presets.
- **Methods**: the active preset rendered verbatim, plus the field contract and the enrichment actors.

## 1. Export your data from LinkedIn

1. On LinkedIn: **Me → Settings & Privacy → Data privacy → Get a copy of your data**.
2. Choose **"Want something in particular?"** and tick **Connections** and **Invitations**. Request the archive.
3. LinkedIn emails a zip within about ten minutes. Unzip it. You need `Connections.csv` and `Invitations.csv`.
4. Open the app and drop each file in its slot (either file works alone). The app identifies a file by its header row, so a file in the wrong slot is moved automatically.

`Connections.csv` starts with a "Notes:" preamble; the app skips it. Dates such as `18 Sep 2026` and `9/18/26, 1:20 AM` are both parsed in code.

## 2. Keys and where to add them

Two secrets, both **server-side only** (they are read by the app's own functions and never sent to the browser):

| Variable | Purpose | Where to get it |
|---|---|---|
| `TYPESAFE_API_KEY` | Jev scoring via `@typesafe-ai/sdk` (`model: jev-latest`) | https://typesafe.ai |
| `APIFY_TOKEN` | Profile and company enrichment via the Apify REST API | Apify Console → Settings → Integrations → API tokens |

**Netlify (production):** Site configuration → Environment variables → add both keys (scope: Functions/Runtime is enough). Redeploy after adding them.

**Local development:** export them in your shell before starting, never in a committed file:

```bash
export TYPESAFE_API_KEY=...   # or keep them in ~/.zshenv
export APIFY_TOKEN=...
npm install
npm run dev
```

`.env.example` lists the names. `.env*` files are git-ignored.

## 3. Edit the ICP config

The default preset is derived from one file: [`src/config/icp.json`](src/config/icp.json).

```json
{
  "company": "[your company and what it sells]",
  "targetRoles": ["Chief of Staff", "COO", "CEO", "President / Managing Director / Owner at family-owned companies"],
  "geography": "United States first; other countries rank lower, not excluded",
  "companyProfile": "Privately held or family-owned; manufacturing, industrial, distribution, construction, logistics preferred; over $50M revenue or 150+ employees when revenue is unknown",
  "disqualifiers": "Students, job seekers, recruiters, agencies selling to me, founders of pre-revenue startups",
  "preferredIndustries": ["manufacturing", "industrial", "distribution", "construction", "logistics"],
  "revenueThreshold": "$50M revenue (or 150+ employees when revenue is unknown)",
  "primaryCountry": "United States"
}
```

- `targetRoles` become the options of the `role` question (plus `other_executive`, `not_executive`, `unknown`).
- `preferredIndustries` become the first options of `company_type` (plus the fixed sector list and `unclear`) and drive the Tier 2 "unknown role at a preferred industry" rule.
- `disqualifiers` is quoted inside the `disqualified` statement.
- `primaryCountry` and `revenueThreshold` feed the post-enrichment `in_geography` and `revenue_over_threshold` questions.

Two ways to change it:

1. **In the app**: Classifier Studio → ICP config → edit → **Rebuild default questions from ICP** → **Save changes** (or **Save as** a new preset). This lives in your browser.
2. **In the repo**: edit `src/config/icp.json`, run `npm run check:contract`, commit and deploy. This changes the shipped default preset for everyone who opens the app fresh (or presses **Reset to defaults**).

The build fails if any default question references a field outside the contract (`npm run check:contract`, run automatically as `prebuild`).

### Built-in presets

Two presets ship with the app and can be restored at any time with **Reset to defaults**:

- **Default ICP**: derived from `src/config/icp.json` (customer discovery: owners and operators of privately held companies).
- **Job Search (CIO)**: derived from `src/config/icp-job-search.json`. Target roles are the people who hire, sponsor or refer for a CIO / CDO / Chief Transformation Officer role (CEO, COO, CFO, CHRO, board members, PE operating partners, retained search partners, peer CIOs). Public companies are in scope, so the big-public-brand exclusion is switched off, and a `recruiter_or_hiring_outreach` intent counts towards Accept on the Invitations tab.

- **Private Equity**: PE deal and operating teams, portfolio CEOs / CFOs / COOs, boards and peer CIOs. Adds a `deal_or_advisory_outreach` intent that counts as Accept.
- **Recruiters & Search Firms**: retained search partners, boutique technology-leadership recruiters, in-house executive recruiting and CHROs. Contract and offshore staffing sellers remain disqualified.
- **Fortune 1000**: executives at the largest US companies. Membership is a fact, so it is matched in code against the preset's **company watchlist** (paste the names in the Studio; the list is not shipped). Before enrichment Jev only judges the role and whether the company reads as a well-known large public corporation, which this lens requires for Tier 1 instead of excluding. Tick "Tier 1 requires a company on this preset's watchlist" once the list is pasted.

Pick any of them from the preset dropdown in Classifier Studio or the **Lens** dropdown on the Radar page. All are editable; save your edits under a new name to keep the built-ins pristine.

**Company watchlist.** Every preset can carry a list of company names (one per line in the Studio). Matching happens in code against the exported Company column, with case, punctuation and Inc/Corp/LLC suffixes normalised. Watchlisted people show a ★, can be filtered on the Radar page, are at least Tier 2 when they hold any executive role, and can be made a Tier 1 requirement with the threshold checkbox. The list travels with the preset JSON and never reaches Jev.

## 4. Share a preset

A preset is one JSON file holding the ICP block, every question (instructions, criteria, fields), and the tier thresholds.

- **Export:** Classifier Studio → **Download JSON**.
- **Import:** Classifier Studio → **Upload JSON**. The preset is saved under its own name and made active.
- **Switch:** the preset dropdown at the top of the Studio. Presets live in your browser only; download them to back up or move machines.
- **Reset:** **Reset to defaults** rebuilds the shipped preset from `icp.json`.

Changing questions makes previously scored rows pending again (the Radar's Run button shows the count). Changing thresholds never re-calls Jev: tiers are recomputed from the stored probabilities.

## 5. Swap the Apify actor

Enrichment configuration is one file: [`src/config/apify.ts`](src/config/apify.ts).

- `PROFILE_ACTOR`: currently `harvestapi/linkedin-profile-scraper` (id `LpVuK3Zozwuipa5bp`, $0.004 per profile, no LinkedIn cookies, up to 100 URLs per run). `buildInput(urls)` maps URLs to the actor's input; `mapProfileItem(item)` maps its output to the app's fields (photo, headline, about, location, country, current company, company URL, follower and connection counts).
- `COMPANY_ACTOR`: `harvestapi/linkedin-company` (id `UwSdACBp7ymaGUJjS`, $0.004 per company), run only for distinct Tier 1 companies whose profile came back with a company URL but no size. `mapCompanyItem` supplies `employeeCount`, `employeeCountRange`, `industry`.
- `POSTS_ACTOR`: `null`. Set one to populate `last_post_date` / `posts_last_30_days`; until then `active_on_linkedin` resolves to `unknown` by design.

**Free-plan limit.** harvestapi's actors refuse more than 10 items per run on a free Apify account and return a single `{ "error": ... }` record while the run still reports success. The app therefore sends 10 profiles per run (`maxItemsPerRun: 10`), treats an error record as a failed run, and shows the actor's message. On a paid Apify plan raise `maxItemsPerRun` to 100 for both actors.

To swap: change `slug`, `actorId`, pricing and `maxItemsPerRun`; rewrite `buildInput` for the new input schema; rewrite the `map*Item` function for the new output. The API route (`src/app/api/enrich/route.ts`) only accepts LinkedIn profile or company URLs and never sees anything else. If Apify is unavailable, the **Import enrichment JSON** drop zone accepts raw actor items or a previous export.

## Deploy

The site is deployed manually from this folder with the Netlify CLI (the CLI login was authorised once in the browser; no token is stored in the repo):

```bash
npx netlify-cli deploy --build --prod
```

That runs the contract check and `next build`, then uploads the result. Environment variables live on the Netlify site as secrets and are read by the two functions only. To switch to push-to-deploy, link the GitHub repository in the Netlify dashboard (Site configuration → Build & deploy → Continuous deployment → Link repository); `netlify.toml` already declares the build command and the Next.js plugin. Netlify rejects site names containing "linkedin", which is why the site is called `radar-transformsmarter`.

## Architecture

- Next.js 16 (App Router, TypeScript, Tailwind v4), deployed on Netlify with `@netlify/plugin-nextjs`.
- `POST /api/score`: up to 50 rows plus the active question spec; validates the spec (Choice 2–255 options each with a criterion, Score 2–10 levels, Noul statement without criteria, at least one contract field, no forbidden field) and rejects any state key outside the contract. Calls Jev with all questions for a row in one request, 8 rows in parallel, exponential backoff on 429/529, and streams one NDJSON line per row (answers, probabilities, confidence, latency, `usage.input_tokens`).
- `POST/GET /api/enrich`: starts Apify runs of ≤100 URLs, the browser polls every 3 s and attaches items as they arrive.
- Browser: CSV parsing, date buckets, has-email, accepted/pending matching, counting, tier math, ranking, filters, exports, IndexedDB persistence.

**Field contract** (the only fields Jev may read before enrichment): Connections `position`, `company`, `name_suffixes` (only when present), `connected_for`; Invitations `name`, `message`, `invitation_age`. Location, country, company size, industry, revenue, photo, headline, activity and mutual connections are forbidden before enrichment and are only available in the post-enrichment pass. INCOMING invitations without a message and all OUTGOING invitations never reach Jev.

## Scripts

```bash
npm run dev            # local dev server
npm run build          # runs the contract check, then next build
npm test               # unit tests (vitest)
npm run fixtures       # generate synthetic fixtures into ./fixtures (git-ignored)
npm run test:e2e       # Playwright end-to-end against the fixtures (needs TYPESAFE_API_KEY in the shell)
npx tsx scripts/calibrate.ts   # score the fixtures and print answer distributions by category
```

## Privacy

Uploaded files stay in the browser. The only data that leaves it: contract fields in scoring batches to this app's own `/api/score` (forwarded to TypeSafe), and the profile URLs you explicitly select for enrichment to this app's `/api/enrich` (forwarded to Apify). Nothing is logged or stored server-side. The app sends no messages and takes no action on LinkedIn.
