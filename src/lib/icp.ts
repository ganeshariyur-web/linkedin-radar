import icpJson from "@/config/icp.json";
import type { IcpConfig } from "./types";

export const DEFAULT_ICP: IcpConfig = icpJson as IcpConfig;

/** Turn a role label into a stable option key. */
export function roleKey(label: string): string {
  const l = label.toLowerCase();
  if (/chief of staff/.test(l)) return "chief_of_staff";
  if (/\bcoo\b|chief operating/.test(l)) return "coo";
  if (/\bceo\b|chief executive/.test(l)) return "ceo";
  if (/\bcfo\b|chief financial/.test(l)) return "cfo";
  if (/\bchro\b|chief people|chief human/.test(l)) return "chro";
  if (/board/.test(l)) return "board_member";
  if (/operating partner|portfolio operations/.test(l)) return "pe_operating_partner";
  if (/private equity/.test(l)) return "pe_investment_partner";
  if (/head of executive recruiting|talent acquisition|in-house/.test(l)) return "inhouse_exec_recruiter";
  if (/executive search|retained search/.test(l)) return "executive_search_partner";
  if (/recruiter|search consultant/.test(l)) return "tech_leadership_recruiter";
  if (/division president|general manager|business unit/.test(l)) return "division_president_gm";
  if (/\bcio\b|\bcto\b|\bcdo\b|\bcdio\b/.test(l)) return "cio_cto_cdo_peer";
  if (/president|managing director|owner/.test(l)) return "president_md_owner";
  return slug(label);
}

export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "option";
}
