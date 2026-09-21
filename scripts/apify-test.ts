// Live test of the selected Apify actors against public profiles, using the
// same input/output mapping the app uses. Run: APIFY_TOKEN=... npx tsx scripts/apify-test.ts
import { PROFILE_ACTOR, COMPANY_ACTOR, mapProfileItem, mapCompanyItem, estimateUsd } from "../src/config/apify";
import { startRun, getRun, getItems, TERMINAL } from "../src/lib/apify-server";

const URLS = [
  "https://www.linkedin.com/in/satyanadella",
  "https://www.linkedin.com/in/reidhoffman",
  "https://www.linkedin.com/in/williamhgates",
  "https://www.linkedin.com/in/melindagates",
  "https://www.linkedin.com/in/jeffweiner08",
];

async function waitFor(runId: string, label: string) {
  const t0 = Date.now();
  for (;;) {
    const run = await getRun(runId);
    if (TERMINAL.has(run.status)) { console.log(`${label}: ${run.status} in ${Math.round((Date.now() - t0) / 1000)}s, usage $${(run.usageTotalUsd ?? 0).toFixed(4)}`); return run; }
    await new Promise((r) => setTimeout(r, 4000));
  }
}

async function main() {
  console.log(`Profile actor ${PROFILE_ACTOR.slug}: ${URLS.length} URLs, estimate $${estimateUsd(PROFILE_ACTOR, URLS.length).toFixed(4)}`);
  const run = await startRun(PROFILE_ACTOR.actorId, PROFILE_ACTOR.buildInput(URLS));
  const done = await waitFor(run.id, "profile run");
  const items = await getItems(done.defaultDatasetId, 0, 100);
  console.log(`items: ${items.length}`);
  const mapped = items.map(mapProfileItem);
  for (const m of mapped) {
    console.log(`- ${m.publicIdentifier} | headline=${m.headline?.slice(0, 50)} | location=${m.location} | country=${m.country} | company=${m.currentCompany} | title=${m.currentTitle?.slice(0, 40)} | companyUrl=${m.companyLinkedinUrl} | photo=${m.photo ? "yes" : "no"} | followers=${m.followerCount}`);
  }
  const missing = ["photo", "headline", "location", "currentCompany"].map((k) => [k, mapped.filter((m) => !(m as never)[k]).length] as const);
  console.log(`missing counts: ${missing.map(([k, n]) => `${k}=${n}`).join(" ")}`);
  const companyUrls = Array.from(new Set(mapped.map((m) => m.companyLinkedinUrl).filter((u): u is string => !!u && /linkedin\.com\/company\//.test(u)))).slice(0, 2);
  if (companyUrls.length) {
    console.log(`Company actor ${COMPANY_ACTOR.slug}: ${companyUrls.length} URLs, estimate $${estimateUsd(COMPANY_ACTOR, companyUrls.length).toFixed(4)}`);
    const crun = await startRun(COMPANY_ACTOR.actorId, COMPANY_ACTOR.buildInput(companyUrls));
    const cdone = await waitFor(crun.id, "company run");
    const citems = await getItems(cdone.defaultDatasetId, 0, 100);
    for (const c of citems.map(mapCompanyItem)) console.log(`- ${c.name} | size=${c.employeeCount} range=${c.employeeCountRange} | industry=${c.industry} | type=${c.companyType} | hq=${c.hqCountry} | url=${c.linkedinUrl}`);
  } else {
    console.log("No company URLs returned; company actor not exercised.");
  }
}
main().catch((e) => { console.error("FAILED:", e instanceof Error ? e.message : e); process.exit(1); });
