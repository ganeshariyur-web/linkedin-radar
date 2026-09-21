# LinkedIn Radar

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

To swap: change `slug`, `actorId`, pricing and `maxItemsPerRun`; rewrite `buildInput` for the new input schema; rewrite the `map*Item` function for the new output. The API route (`src/app/api/enrich/route.ts`) only accepts LinkedIn profile or company URLs and never sees anything else. If Apify is unavailable, the **Import enrichment JSON** drop zone accepts raw actor items or a previous export.

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
