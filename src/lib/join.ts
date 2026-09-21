// Accepted / pending matching between Invitations and Connections. Pure code;
// never a Jev question.

import type { ConnectionRow, InvitationRow, MatchStatus } from "./types";

/** Normalise a LinkedIn profile URL to a stable key. */
export function urlKey(url: string): string {
  let u = url.trim().toLowerCase();
  if (!u) return "";
  u = u.replace(/^https?:\/\//, "").replace(/^www\./, "");
  u = u.split(/[?#]/)[0];
  u = u.replace(/\/+$/, "");
  return u;
}

export function matchInvitations(invitations: InvitationRow[], connections: ConnectionRow[]): InvitationRow[] {
  const keys = new Set(connections.map((c) => c.urlKey).filter(Boolean));
  return invitations.map((inv) => {
    let match: MatchStatus;
    if (!inv.urlKey) match = "unknown";
    else match = keys.has(inv.urlKey) ? "accepted" : "pending";
    return { ...inv, match };
  });
}
