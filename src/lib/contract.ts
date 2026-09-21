// The field contract: the only fields Jev may read, per tab and pass.
// Everything else is computed in code or forbidden outright.

import type { Pass, Tab } from "./types";

export interface ContractField {
  name: string;
  /** Column(s) in the uploaded file this field is derived from, or the enrichment source. */
  source: string;
  description: string;
  /** Present on every row, or only when the source has a value. */
  presence: "always" | "when present";
}

export const CONTRACT: Record<Tab, Record<Pass, ContractField[]>> = {
  connections: {
    pre: [
      { name: "position", source: "Position", description: "Job title text as exported. Empty on some rows.", presence: "always" },
      { name: "company", source: "Company", description: "Company name text as exported. Empty on some rows.", presence: "always" },
      { name: "name_suffixes", source: "Last Name (after the comma)", description: "Credentials following the last name, e.g. \"PharmD, MBA\".", presence: "when present" },
      { name: "connected_for", source: "Connected On (bucketed in code)", description: '"under 1 year", "1–3 years" or "3+ years".', presence: "always" },
    ],
    post: [
      { name: "headline", source: "Apify profile: headline", description: "Profile headline.", presence: "when present" },
      { name: "about", source: "Apify profile: about (first 600 chars)", description: "About section.", presence: "when present" },
      { name: "location", source: "Apify profile: location.linkedinText", description: "Location as shown on the profile.", presence: "when present" },
      { name: "country", source: "Apify profile: location.parsed.country", description: "Country name.", presence: "when present" },
      { name: "current_company", source: "Apify profile: currentPosition[0].companyName", description: "Current employer.", presence: "when present" },
      { name: "current_title", source: "Apify profile: experience[0].position", description: "Current title.", presence: "when present" },
      { name: "company_size", source: "Apify company: employeeCount", description: "Employee count of the current company.", presence: "when present" },
      { name: "company_size_range", source: "Apify company: employeeCountRange", description: "LinkedIn size band, e.g. 201-500.", presence: "when present" },
      { name: "company_industry", source: "Apify company: industry", description: "LinkedIn industry label.", presence: "when present" },
      { name: "company_ownership", source: "Apify company: companyType", description: "LinkedIn ownership label: Privately Held, Public Company, Self-Owned, Nonprofit, etc.", presence: "when present" },
      { name: "follower_count", source: "Apify profile: followerCount", description: "Follower count.", presence: "when present" },
      { name: "connections_count", source: "Apify profile: connectionsCount", description: "Connection count.", presence: "when present" },
      { name: "open_to_work", source: "Apify profile: openToWork", description: "Open-to-work flag.", presence: "when present" },
      { name: "last_post_date", source: "Apify posts (optional actor)", description: "Date of the most recent post, when a posts actor is configured.", presence: "when present" },
      { name: "posts_last_30_days", source: "Apify posts (optional actor)", description: "Posts in the last 30 days, when a posts actor is configured.", presence: "when present" },
    ],
  },
  invitations: {
    pre: [
      { name: "name", source: "From (INCOMING) or To (OUTGOING)", description: "The other party's display name, including any credentials.", presence: "always" },
      { name: "message", source: "Message", description: "Invitation note. Rows with an empty message are never sent to Jev.", presence: "always" },
      { name: "invitation_age", source: "Sent At (bucketed in code)", description: '"this week", "this month" or "older".', presence: "always" },
    ],
    post: [] as ContractField[],
  },
};
// Post-enrichment fields are shared by both tabs.
CONTRACT.invitations.post = CONTRACT.connections.post;

/** Fields that never appear in any pre-enrichment question. */
export const FORBIDDEN_PRE_ENRICHMENT = [
  "location",
  "country",
  "company_size",
  "company_size_range",
  "industry",
  "company_industry",
  "industry_code",
  "revenue",
  "photo",
  "headline",
  "activity",
  "last_post_date",
  "posts_last_30_days",
  "mutual_connections",
  "email",
  "has_email",
  "connected_on",
  "sent_at",
  "direction",
  "url",
];

/** Computed in code and never asked of Jev. */
export const CODE_OWNED = [
  "has_email",
  "all date arithmetic (connected_for, invitation_age buckets)",
  "direction",
  "accepted / pending matching",
  "all counting",
  "all tier math and thresholds",
  "final ranking",
];

export function contractFieldNames(tab: Tab, pass: Pass): string[] {
  return CONTRACT[tab][pass].map((f) => f.name);
}

export function isContractField(tab: Tab, pass: Pass, field: string): boolean {
  return contractFieldNames(tab, pass).includes(field);
}
