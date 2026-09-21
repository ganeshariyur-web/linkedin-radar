// Default question specs derived from the ICP, plus the validation rules the
// Studio and the scoring route both enforce.

import { contractFieldNames, FORBIDDEN_PRE_ENRICHMENT } from "./contract";
import { roleKey, slug } from "./icp";
import type { IcpConfig, Pass, QuestionSpec, Tab } from "./types";

export const EXECUTIVE_ROLE_KEYS_EXTRA = ["other_executive"];
export const NON_TARGET_ROLE_KEYS = ["other_executive", "not_executive", "unknown"];

function roleDescription(label: string): string {
  const l = label.toLowerCase();
  if (/chief of staff/.test(l)) return "Chief of Staff, or an equivalent right-hand role to a CEO or President.";
  if (/\bcoo\b/.test(l)) return "Chief Operating Officer, or the head of operations for the whole company.";
  if (/\bceo\b/.test(l)) return "Chief Executive Officer.";
  if (/\bcfo\b|chief financial/.test(l)) return "Chief Financial Officer or the head of finance for the whole company.";
  if (/\bchro\b|chief people|chief human/.test(l)) return "Chief Human Resources Officer, Chief People Officer, or the head of HR / talent for the whole company.";
  if (/board/.test(l)) return "Board member, board director, independent director, board chair, or advisory board member.";
  if (/operating partner|portfolio operations|private equity/.test(l)) return "Private equity operating partner, portfolio operations leader, or PE investment professional (Partner, Principal, Managing Director at a PE firm).";
  if (/executive search|retained search|recruiter/.test(l)) return "Executive search partner, retained search consultant, or executive recruiter who places C-level and VP roles.";
  if (/\bcio\b|\bcto\b|\bcdo\b|\bcdio\b/.test(l)) return "A peer technology executive: CIO, CTO, CDO, CDIO, Chief Digital or Chief Transformation Officer.";
  if (/president|managing director|owner/.test(l))
    return "President, Managing Director, Owner, Principal, Proprietor or Founder-Owner running the company, typically at a privately held or family-owned firm.";
  return `Matches the target role "${label}".`;
}

export function targetRoleKeys(icp: IcpConfig): string[] {
  return Array.from(new Set(icp.targetRoles.map(roleKey)));
}

export function buildDefaultQuestions(icp: IcpConfig): QuestionSpec[] {
  const roleOptions = icp.targetRoles.map((label) => ({ key: roleKey(label), description: roleDescription(label) }));
  const industryOptions = icp.preferredIndustries.map((ind) => ({
    key: slug(ind),
    description: industryDescription(ind),
  }));
  const preferredKeys = new Set(industryOptions.map((o) => o.key));
  const fixedIndustryOptions = [
    { key: "professional_services", description: "Consulting, law, accounting, staffing, agencies, advisory, or other professional services." },
    { key: "tech_or_software", description: "Software, SaaS, IT services, hardware, or internet companies." },
    { key: "finance", description: "Banking, insurance, private equity, venture capital, wealth management, or lending." },
    { key: "healthcare", description: "Hospitals, providers, payers, pharma, biotech, or medical devices." },
    { key: "education_or_nonprofit", description: "Schools, universities, charities, foundations, associations, or government." },
    { key: "other", description: "A recognisable industry not listed above (retail, hospitality, media, energy, agriculture, real estate)." },
    { key: "unclear", description: "The name carries no industry signal." },
  ].filter((o) => !preferredKeys.has(o.key));

  const q: QuestionSpec[] = [
    {
      id: "role",
      type: "choice",
      tab: "connections",
      pass: "pre",
      enabled: true,
      fields: ["position", "name_suffixes"],
      instructions:
        "Classify the person's role from the `position` text (and `name_suffixes` when present) only. " +
        "Do not infer from the company. Choose \"unknown\" when `position` is empty, missing, or too vague to place in any other bucket " +
        "(for example a bare company name, a slogan, or a single word like \"Professional\").",
      options: [
        ...roleOptions,
        { key: "other_executive", description: "Another executive: C-level not listed above, EVP, SVP, VP, General Manager, Partner, or Board Director." },
        { key: "not_executive", description: "Director and below: manager, individual contributor, consultant, analyst, student, intern, or a non-executive role." },
        { key: "unknown", description: "The position is empty or too vague to classify." },
      ],
    },
    {
      id: "company_type",
      type: "choice",
      tab: "connections",
      pass: "pre",
      enabled: true,
      fields: ["company", "position"],
      instructions:
        "Judge the company's sector from the `company` name text and the `position` title text only. " +
        "There is no other information about the company. Choose \"unclear\" when the name carries no industry signal " +
        "(a surname, initials, or a generic word like \"Group\" alone).",
      options: [...industryOptions, ...fixedIndustryOptions],
    },
    {
      id: "likely_private_or_family",
      type: "noul",
      tab: "connections",
      pass: "pre",
      enabled: true,
      fields: ["company"],
      instructions:
        "The company name suggests a privately held or family-owned business (a surname, '& Sons', 'Group', 'Holdings', a regional or trade-specific name) rather than a well-known public corporation.",
    },
    {
      id: "is_big_public_brand",
      type: "noul",
      tab: "connections",
      pass: "pre",
      enabled: true,
      fields: ["company"],
      instructions: "The company is a well-known large public corporation.",
    },
    {
      id: "disqualified",
      type: "noul",
      tab: "connections",
      pass: "pre",
      enabled: true,
      fields: ["position"],
      instructions:
        `The position text shows this person matches one of the ICP disqualifiers: ${icp.disqualifiers}. ` +
        "An empty position is not a disqualifier.",
    },
    {
      id: "message_intent",
      type: "choice",
      tab: "invitations",
      pass: "pre",
      enabled: true,
      fields: ["message", "name"],
      instructions:
        "Read the invitation `message` and judge what the sender wants. Use only the message text and the `name` field.",
      options: [
        { key: "genuine_networking", description: "Wants to connect as a peer: shared industry, event, mutual interest, or a specific reason to know each other, with no ask attached." },
        { key: "wants_to_sell_me_something", description: "Pitches a product, service, agency, lead-generation, recruiting service, or asks for a demo or call to sell." },
        { key: "wants_a_job_or_mentoring", description: "Asks for a job, referral, internship, career advice, mentoring, or a resume review." },
        { key: "fan_or_learner", description: "Follows the recipient's content or work and wants to learn from it, with no commercial or job ask." },
        { key: "spam_or_bot", description: "Template text, irrelevant content, suspicious links, or a message that reads as automated." },
      ],
    },
    {
      id: "self_described_seniority",
      type: "choice",
      tab: "invitations",
      pass: "pre",
      enabled: true,
      fields: ["message", "name"],
      instructions:
        "Determine the sender's seniority using only what the `message` states about themselves or credentials in the `name` field. " +
        "Do not guess from tone. Choose \"not_stated\" when neither the message nor the name states a role or level.",
      options: [
        { key: "c_level_or_owner", description: "States they are a CEO, COO, CFO, President, Owner, Founder running a company, Managing Director, or Chief of Staff." },
        { key: "director_or_vp", description: "States they are a Director, Senior Director, VP, SVP, EVP, Partner, or General Manager." },
        { key: "manager_or_ic", description: "States they are a manager, team lead, engineer, analyst, consultant, or another individual contributor." },
        { key: "student_or_junior", description: "States they are a student, recent graduate, intern, or early in their career." },
        { key: "not_stated", description: "Neither the message nor the name states a role or level." },
      ],
    },
    // Post-enrichment pass. State is the enriched fields only.
    {
      id: "in_geography",
      type: "noul",
      tab: "connections",
      pass: "post",
      enabled: true,
      fields: ["location", "country"],
      instructions: `The person is located in ${icp.primaryCountry}, based on the \`location\` and \`country\` fields.`,
    },
    {
      id: "revenue_over_threshold",
      type: "score",
      tab: "connections",
      pass: "post",
      enabled: true,
      fields: ["company_size", "company_size_range", "company_industry", "current_company", "headline"],
      instructions:
        `Estimate whether the person's current company exceeds ${icp.revenueThreshold}. ` +
        "Use `company_size`, `company_size_range` and `company_industry` when present; otherwise judge from `current_company` and `headline`. " +
        "Choose \"Unclear\" when the fields carry no size signal.",
      levels: ["Almost certainly under", "Probably under", "Unclear", "Probably over", "Almost certainly over"],
    },
    {
      id: "family_business",
      type: "noul",
      tab: "connections",
      pass: "post",
      enabled: true,
      fields: ["current_company", "company_industry", "company_ownership", "headline", "about"],
      instructions:
        "The person's current company is a family-owned or closely held private business, judged from `company_ownership` (LinkedIn's label such as Privately Held, Self-Owned or Public Company) when present, and otherwise from `current_company`, `company_industry`, `headline` and `about`.",
    },
    {
      id: "decision_maker",
      type: "noul",
      tab: "connections",
      pass: "post",
      enabled: true,
      fields: ["current_title", "headline", "about", "company_size"],
      instructions:
        `The person holds ${icp.decisionAuthority ?? "approval authority for a significant advisory or technology engagement at their company (they can sign off without escalating)"}, ` +
        "judged from `current_title`, `headline`, `about` and `company_size`.",
    },
    {
      id: "active_on_linkedin",
      type: "choice",
      tab: "connections",
      pass: "post",
      enabled: true,
      fields: ["last_post_date", "posts_last_30_days"],
      instructions:
        "Judge activity from the explicit activity fields `last_post_date` and `posts_last_30_days` only. " +
        "Choose \"unknown\" when both fields are missing or null. Never infer activity from any other field.",
      options: [
        { key: "posted_in_last_30_days", description: "`posts_last_30_days` is 1 or more, or `last_post_date` falls within the last 30 days." },
        { key: "posted_in_last_6_months", description: "`last_post_date` falls within the last 6 months but not the last 30 days." },
        { key: "dormant", description: "`last_post_date` is older than 6 months, or `posts_last_30_days` is 0 with no recent date." },
        { key: "unknown", description: "Both activity fields are missing or null." },
      ],
    },
  ];
  return q;
}

function industryDescription(ind: string): string {
  const l = ind.toLowerCase();
  if (l.startsWith("manufactur")) return "Makes physical products: manufacturing, machining, fabrication, plastics, packaging, food processing, components.";
  if (l.startsWith("industrial")) return "Industrial equipment, engineering, automation, machinery, or industrial services.";
  if (l.startsWith("distribut")) return "Wholesale, distribution, or supply of goods to businesses.";
  if (l.startsWith("construct")) return "Construction, contracting, building trades, engineering and construction, or building materials.";
  if (l.startsWith("logist")) return "Logistics, trucking, freight, warehousing, shipping, or supply chain services.";
  if (l.startsWith("health")) return "Hospitals, health systems, providers, payers, or healthcare services.";
  if (l.startsWith("life sci")) return "Pharma, biotech, CROs, diagnostics, or life sciences tools.";
  if (l.startsWith("medtech") || l.startsWith("medical dev")) return "Medical devices, MedTech, or diagnostics equipment.";
  if (l.startsWith("private equity") || l === "pe") return "A private equity firm, PE fund, or PE-backed holding company.";
  if (l.startsWith("executive search") || l.startsWith("retained search")) return "A retained executive search or leadership advisory firm.";
  return `Operates in ${ind}.`;
}

// ---------- Validation ----------

export interface ValidationIssue {
  level: "error" | "warning";
  field: string;
  message: string;
}

const ID_RE = /^[a-z][a-z0-9_]{0,63}$/;

export function validateQuestion(
  q: QuestionSpec,
  opts: { availableFields?: string[] | null; allQuestionIds?: string[] } = {},
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const err = (field: string, message: string) => issues.push({ level: "error", field, message });
  const warn = (field: string, message: string) => issues.push({ level: "warning", field, message });

  if (!ID_RE.test(q.id)) err("id", "ID must be lowercase letters, digits and underscores, starting with a letter.");
  if (opts.allQuestionIds && opts.allQuestionIds.filter((x) => x === q.id).length > 1) err("id", "ID must be unique.");
  if (!["choice", "score", "noul"].includes(q.type)) err("type", "Type must be choice, score or noul.");
  if (!["connections", "invitations"].includes(q.tab)) err("tab", "Tab must be connections or invitations.");
  if (!["pre", "post"].includes(q.pass)) err("pass", "Pass must be pre or post.");
  if (!q.instructions || !q.instructions.trim()) err("instructions", q.type === "noul" ? "A Noul needs a statement." : "Instructions are required.");

  // Fields
  if (!Array.isArray(q.fields) || q.fields.length === 0) err("fields", "Select at least one field.");
  else {
    const allowed = contractFieldNames(q.tab as Tab, q.pass as Pass);
    for (const f of q.fields) {
      if (!allowed.includes(f)) err("fields", `"${f}" is not in the ${q.tab} ${q.pass}-enrichment contract.`);
      if (q.pass === "pre" && FORBIDDEN_PRE_ENRICHMENT.includes(f)) err("fields", `"${f}" is forbidden before enrichment.`);
    }
    if (opts.availableFields) {
      for (const f of q.fields) {
        if (!opts.availableFields.includes(f)) warn("fields", `"${f}" is missing from the current upload; this question cannot run until it is present.`);
      }
    }
  }

  if (q.type === "choice") {
    const opt = q.options ?? [];
    if (opt.length < 2) err("options", "A Choice needs at least 2 options.");
    if (opt.length > 255) err("options", "A Choice allows at most 255 options.");
    const keys = new Set<string>();
    opt.forEach((o, i) => {
      if (!o.key || !ID_RE.test(o.key)) err(`options.${i}.key`, `Option ${i + 1}: key must be lowercase letters, digits and underscores.`);
      if (keys.has(o.key)) err(`options.${i}.key`, `Option "${o.key}" is duplicated.`);
      keys.add(o.key);
      if (!o.description || !o.description.trim()) err(`options.${i}.description`, `Option "${o.key || i + 1}" needs a criterion.`);
    });
    if (q.levels && q.levels.length) warn("levels", "Score levels are ignored on a Choice question.");
    // Contradiction heuristics: instructions name an option that does not exist.
    const quoted = Array.from(q.instructions?.matchAll(/"([a-z][a-z0-9_]+)"/g) ?? []).map((m) => m[1]);
    for (const name of quoted) {
      if (!keys.has(name) && /^[a-z0-9_]+$/.test(name) && name.includes("_")) {
        warn("instructions", `Instructions mention "${name}" but no option has that key.`);
      }
    }
    if (/\b(yes|no)\b.*\b(answer|choose)\b/i.test(q.instructions ?? "") && !keys.has("yes")) {
      warn("instructions", "Instructions ask for yes/no but this is a Choice; consider a Noul.");
    }
  } else if (q.type === "score") {
    const lv = q.levels ?? [];
    if (lv.length < 2) err("levels", "A Score needs at least 2 ordered levels.");
    if (lv.length > 10) err("levels", "A Score allows at most 10 levels.");
    lv.forEach((l, i) => {
      if (!l || !l.trim()) err(`levels.${i}`, `Level ${i + 1} needs a description.`);
    });
    if (q.options && q.options.length) warn("options", "Choice options are ignored on a Score question.");
    if (/\b(pick|choose) one of\b/i.test(q.instructions ?? "")) warn("instructions", "Instructions read like a Choice; a Score expects a degree along one dimension.");
  } else if (q.type === "noul") {
    if (q.options && q.options.length) err("options", "A Noul takes a statement only; remove the options.");
    if (q.levels && q.levels.length) err("levels", "A Noul takes a statement only; remove the levels.");
    if (/\?\s*$/.test(q.instructions ?? "") && /\b(which|what|how many)\b/i.test(q.instructions ?? "")) {
      warn("instructions", "A Noul statement should be a proposition that is true or false, not a which/what question.");
    }
  }
  return issues;
}

export function validateQuestions(qs: QuestionSpec[], availableFields?: string[] | null): Record<string, ValidationIssue[]> {
  const ids = qs.map((q) => q.id);
  const out: Record<string, ValidationIssue[]> = {};
  for (const q of qs) out[q.id] = validateQuestion(q, { availableFields, allQuestionIds: ids });
  return out;
}

export function hasErrors(issues: ValidationIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

/** Stable hash of the question set that matters for results (ignores enabled=false questions). */
export function questionsHash(qs: QuestionSpec[], pass: Pass, tab: Tab): string {
  const relevant = qs
    .filter((q) => q.enabled && q.pass === pass && q.tab === tab)
    .map((q) => ({ id: q.id, type: q.type, instructions: q.instructions, fields: [...q.fields].sort(), options: q.options, levels: q.levels }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return fnv1a(JSON.stringify(relevant));
}

export function fnv1a(str: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
