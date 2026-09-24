// Apify actor configuration. One file: actor IDs, input mapping, output mapping,
// pricing used for the in-app estimate. Swap the actor here (see README).
//
// Selected 2026-09-21 from the Apify Store: harvestapi/linkedin-profile-scraper.
// Criteria: accepts a list of profile URLs per run, requires no LinkedIn cookies,
// returns photo, headline, location, current company (plus company LinkedIn URL,
// follower and connection counts). Company size and industry come from the
// companion company actor, run only for distinct Tier 1 companies without size.

export interface ActorConfig {
  /** Store slug, e.g. "harvestapi/linkedin-profile-scraper". */
  slug: string;
  /** Actor ID as returned by the Apify API (stable even if the slug changes). */
  actorId: string;
  /** USD charged per result item. */
  usdPerItem: number;
  /** Fixed USD per run start (0 when the actor has no start event). */
  usdPerRunStart: number;
  /** Max items per run the app will send. */
  maxItemsPerRun: number;
  /** Build the actor input from a list of URLs. */
  buildInput: (urls: string[]) => Record<string, unknown>;
}

export const PROFILE_ACTOR: ActorConfig = {
  slug: "harvestapi/linkedin-profile-scraper",
  actorId: "LpVuK3Zozwuipa5bp",
  usdPerItem: 0.004, // "$4 per 1000 Profile details" (pricing read 2026-09-21)
  usdPerRunStart: 0,
  // The actor refuses more than 10 items per run for free Apify accounts (observed 2026-09-21:
  // a 100-URL run returned one {error} record and charged one item). A paid Apify plan lifts this;
  // raise to 100 then. Runs are sequential, so 100 profiles = 10 runs of ~10 seconds each.
  maxItemsPerRun: 10,
  buildInput: (urls) => ({
    urls,
    profileScraperMode: "Profile details no email ($4 per 1k)",
  }),
};

export const COMPANY_ACTOR: ActorConfig = {
  slug: "harvestapi/linkedin-company",
  actorId: "UwSdACBp7ymaGUJjS",
  usdPerItem: 0.004, // FREE tier "Company details result" (pricing read 2026-09-21)
  usdPerRunStart: 0.00005,
  maxItemsPerRun: 10, // same publisher; assume the same free-plan cap until a paid plan is in place
  buildInput: (urls) => ({ companies: urls }),
};

/** Optional posts actor for last-activity fields. Null = not configured; active_on_linkedin resolves to "unknown". */
export const POSTS_ACTOR: ActorConfig | null = null;

export function estimateUsd(actor: ActorConfig, count: number): number {
  const runs = Math.ceil(count / actor.maxItemsPerRun);
  return count * actor.usdPerItem + runs * actor.usdPerRunStart;
}

/** An actor-level error record, e.g. {"error": "Free users are limited to 10 items per run..."} */
export function actorErrorOf(items: Record<string, unknown>[]): string | null {
  for (const it of items) {
    const keys = Object.keys(it);
    if (keys.length <= 2 && typeof it.error === "string") return it.error;
  }
  return null;
}

// ---------- Output mapping ----------

type AnyRec = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => (typeof v === "number" && isFinite(v) ? v : null);
const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
const rec = (v: unknown): AnyRec | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as AnyRec) : null);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export interface MappedProfile {
  linkedinUrl: string | null;
  publicIdentifier: string | null;
  photo: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  country: string | null;
  countryCode: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  companyLinkedinUrl: string | null;
  followerCount: number | null;
  connectionsCount: number | null;
  openToWork: boolean | null;
}

/** Map one harvestapi profile item to the app's enrichment fields. */
export function mapProfileItem(item: AnyRec): MappedProfile {
  const loc = rec(item.location);
  const parsed = loc ? rec(loc.parsed) : null;
  const current = arr(item.currentPosition).map(rec).filter(Boolean) as AnyRec[];
  const experience = arr(item.experience).map(rec).filter(Boolean) as AnyRec[];
  const currentExp =
    experience.find((e) => {
      const end = rec(e.endDate);
      return !end || /present/i.test(String(end.text ?? "")) || (!end.year && !end.text);
    }) ?? experience[0];
  return {
    linkedinUrl: str(item.linkedinUrl),
    publicIdentifier: str(item.publicIdentifier),
    photo: str(item.photo),
    headline: str(item.headline),
    about: str(item.about),
    location: str(loc?.linkedinText) ?? str(parsed?.text),
    country: str(parsed?.country) ?? str(parsed?.countryFull),
    countryCode: str(loc?.countryCode) ?? str(parsed?.countryCode),
    currentCompany: str(current[0]?.companyName) ?? str(currentExp?.companyName),
    currentTitle: str(currentExp?.position),
    companyLinkedinUrl: str(currentExp?.companyLinkedinUrl),
    followerCount: num(item.followerCount),
    connectionsCount: num(item.connectionsCount),
    openToWork: bool(item.openToWork),
  };
}

export interface MappedCompany {
  linkedinUrl: string | null;
  universalName: string | null;
  name: string | null;
  employeeCount: number | null;
  employeeCountRange: string | null;
  industry: string | null;
  companyType: string | null;
  hqCountry: string | null;
}

/** Map one harvestapi company item. */
export function mapCompanyItem(item: AnyRec): MappedCompany {
  const range = rec(item.employeeCountRange);
  const start = range ? num(range.start) : null;
  const end = range ? num(range.end) : null;
  const industries = arr(item.industries).map((x) => (typeof x === "string" ? x : str(rec(x)?.name))).filter(Boolean) as string[];
  const locations = arr(item.locations).map(rec).filter(Boolean) as AnyRec[];
  const hq = locations.find((l) => l.headquarter === true) ?? locations[0];
  const hqParsed = hq ? rec(hq.parsed) : null;
  return {
    linkedinUrl: str(item.linkedinUrl),
    universalName: str(item.universalName),
    name: str(item.name),
    employeeCount: num(item.employeeCount),
    employeeCountRange: start !== null ? (end !== null ? `${start}-${end}` : `${start}+`) : null,
    industry: str(item.industry) ?? industries[0] ?? null,
    companyType: str(item.companyType),
    hqCountry: str(hqParsed?.country) ?? str(hq?.country),
  };
}
