// Core data types for LinkedIn Radar. Code owns every field here; Jev only
// ever sees the contract fields assembled in lib/state.ts.

export type Tab = "connections" | "invitations";
export type Pass = "pre" | "post";

export type ConnectedFor = "under 1 year" | "1–3 years" | "3+ years";
export type InvitationAge = "this week" | "this month" | "older";

export interface ConnectionRow {
  id: string;
  firstName: string;
  lastName: string;
  /** Last name with credentials stripped, e.g. "Rahman" from "Rahman, PharmD". */
  lastNameClean: string;
  /** Credentials following the last name, e.g. "PharmD, MBA"; null when absent. */
  nameSuffixes: string | null;
  url: string;
  urlKey: string;
  email: string;
  hasEmail: boolean;
  company: string;
  position: string;
  connectedOnRaw: string;
  connectedOn: string | null; // ISO date
  connectedFor: ConnectedFor | null;
}

export type Direction = "INCOMING" | "OUTGOING";
export type MatchStatus = "accepted" | "pending" | "unknown";

export interface InvitationRow {
  id: string;
  from: string;
  to: string;
  /** The other party's display name (From for INCOMING, To for OUTGOING). */
  name: string;
  sentAtRaw: string;
  sentAt: string | null; // ISO datetime
  invitationAge: InvitationAge | null;
  message: string;
  hasMessage: boolean;
  direction: Direction;
  inviterProfileUrl: string;
  inviteeProfileUrl: string;
  /** Profile URL of the other party. */
  profileUrl: string;
  urlKey: string;
  /** Computed only when Connections is also loaded. */
  match: MatchStatus | null;
}

export interface UploadStats {
  fileName: string;
  schema: Tab;
  rawLineCount: number;
  rawDataLineCount: number;
  parsedRowCount: number;
  dateFormat: string;
  emptyPosition?: number;
  emptyCompany?: number;
  withEmail?: number;
  withoutMessage?: number;
  incoming?: number;
  outgoing?: number;
  preambleLines: number;
  columns: string[];
}

export type QuestionType = "choice" | "score" | "noul";

export interface ChoiceOption {
  key: string;
  description: string;
}

export interface QuestionSpec {
  id: string;
  type: QuestionType;
  tab: Tab;
  pass: Pass;
  enabled: boolean;
  instructions: string;
  /** Contract fields this question reads. */
  fields: string[];
  options?: ChoiceOption[]; // choice
  levels?: string[]; // score, ordered low to high
}

export interface QuestionAnswer {
  type: QuestionType;
  /** Choice key, score expected value, or "yes"/"no" for noul. */
  answer: string;
  /** Probability of the chosen option / noul yes-probability / score confidence. */
  probability: number;
  confidence: number | null;
  probabilities: Record<string, number>;
  score?: number;
  noul?: number;
}

export interface RowResult {
  rowId: string;
  pass: Pass;
  questionsHash: string;
  answers: Record<string, QuestionAnswer>;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  model: string;
  scoredAt: string;
  error?: string;
}

export interface Thresholds {
  t1RoleConfidence: number; // >=
  t1DisqualifiedMax: number; // <
  t1BigBrandMax: number; // <
  t2RoleConfidenceMin: number; // >= (and < t1RoleConfidence)
  t2PrivateFamilyMin: number; // >=
  rejectedDisqualifiedMin: number; // >=
  invIgnoreMin: number; // spam or sell prob >=
  seniorBuckets: string[];
  geographyMin: number; // in_geography noul >= counts as ICP geography
}

export type ConnectionTier = "tier1" | "tier2" | "tier3" | "rejected" | "unscored";
export type InvitationBucket = "accept" | "review" | "ignore" | "no_signal" | "outgoing" | "unscored";

export interface IcpConfig {
  company: string;
  targetRoles: string[];
  geography: string;
  companyProfile: string;
  disqualifiers: string;
  /** Derived lists used to build option sets; editable alongside the prose. */
  preferredIndustries: string[];
  revenueThreshold: string;
  primaryCountry: string;
}

export interface Preset {
  name: string;
  version: number;
  createdAt: string;
  icp: IcpConfig;
  questions: QuestionSpec[];
  thresholds: Thresholds;
}

export interface Enrichment {
  rowId: string;
  source: "apify" | "import";
  fetchedAt: string;
  photo: string | null;
  headline: string | null;
  about: string | null;
  location: string | null;
  country: string | null;
  countryCode: string | null;
  currentCompany: string | null;
  currentTitle: string | null;
  companyLinkedinUrl: string | null;
  companySize: number | null;
  companySizeRange: string | null;
  companyIndustry: string | null;
  /** LinkedIn ownership label, e.g. "Privately Held", "Public Company", "Self-Owned". */
  companyOwnership: string | null;
  followerCount: number | null;
  connectionsCount: number | null;
  openToWork: boolean | null;
  lastPostDate: string | null;
  postsLast30Days: number | null;
}

export interface RowFlags {
  dmSent: boolean;
  accepted: boolean;
}
