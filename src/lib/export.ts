"use client";
import { toCsv } from "./csv";
import type { ConnectionRow, ConnectionTier, InvitationBucket, InvitationRow, RowResult, Enrichment } from "./types";

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function connectionsCsv(
  rows: { row: ConnectionRow; tier: ConnectionTier; pre?: RowResult; post?: RowResult; enrichment?: Enrichment }[],
): string {
  const header = [
    "First Name", "Last Name", "URL", "Email Address", "Company", "Position", "Connected On", "Connected For", "Tier",
    "Role", "Role Confidence", "Company Type", "Private/Family P", "Big Public Brand P", "Disqualified P",
    "Country", "Company Size", "Industry", "In Geography P", "Decision Maker P", "Revenue Score", "Input Tokens", "Latency ms",
  ];
  const data = rows.map(({ row, tier, pre, post, enrichment }) => [
    row.firstName, row.lastName, row.url, row.email, row.company, row.position, row.connectedOnRaw, row.connectedFor ?? "", tier,
    pre?.answers.role?.answer ?? "", fmt(pre?.answers.role?.confidence), pre?.answers.company_type?.answer ?? "",
    fmt(pre?.answers.likely_private_or_family?.noul), fmt(pre?.answers.is_big_public_brand?.noul), fmt(pre?.answers.disqualified?.noul),
    enrichment?.country ?? "", enrichment?.companySize ?? "", enrichment?.companyIndustry ?? "",
    fmt(post?.answers.in_geography?.noul), fmt(post?.answers.decision_maker?.noul), fmt(post?.answers.revenue_over_threshold?.score),
    (pre?.inputTokens ?? 0) + (post?.inputTokens ?? 0), pre?.latencyMs ?? "",
  ]);
  return toCsv(header, data);
}

export function invitationsCsv(rows: { row: InvitationRow; bucket: InvitationBucket; pre?: RowResult }[]): string {
  const header = ["From", "To", "Sent At", "Message", "Direction", "inviterProfileUrl", "inviteeProfileUrl", "Invitation Age", "Match", "Bucket", "Intent", "Intent Confidence", "Seniority", "Input Tokens"];
  const data = rows.map(({ row, bucket, pre }) => [
    row.from, row.to, row.sentAtRaw, row.message, row.direction, row.inviterProfileUrl, row.inviteeProfileUrl, row.invitationAge ?? "", row.match ?? "", bucket,
    pre?.answers.message_intent?.answer ?? "", fmt(pre?.answers.message_intent?.confidence), pre?.answers.self_described_seniority?.answer ?? "", pre?.inputTokens ?? "",
  ]);
  return toCsv(header, data);
}

function fmt(n: number | null | undefined): string {
  return n === null || n === undefined ? "" : n.toFixed(2);
}
