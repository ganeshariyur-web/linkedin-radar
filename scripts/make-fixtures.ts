// Generates synthetic LinkedIn export fixtures into ./fixtures (gitignored).
// Deterministic (seeded) so tests can assert exact counts. No real people.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "fixtures");
mkdirSync(OUT, { recursive: true });

let seed = 20260921;
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)];

const FIRST = ["Avery", "Jordan", "Priya", "Marcus", "Elena", "Tomas", "Nadia", "Kwame", "Ingrid", "Rafael", "Mei", "Declan", "Sofia", "Hiro", "Amara", "Lucas", "Zara", "Owen", "Leila", "Mateo", "Chloe", "Ravi", "Anika", "Bram", "Yara", "Felix", "Noor", "Callum", "Dalia", "Emeka"];
const LAST = ["Hartwell", "Okafor", "Lindqvist", "Delgado", "Nakamura", "Kessler", "Abernathy", "Moreau", "Castellano", "Whitfield", "Oyelaran", "Brandt", "Ferreira", "Sato", "Pemberton", "Vasquez", "Holloway", "Achebe", "Sørensen", "Marchetti"];
const CREDS = ["MBA", "PhD", "PE", "CPA", "PMP", "MBA, CPA", "PharmD"];

const FAMILY_CO = ["Hartwell & Sons Precision Machining", "Kessler Group", "Delgado Holdings", "Midwest Steel Fabricators", "Brandt Brothers Logistics", "Whitfield Industrial Supply", "Pemberton Construction Co.", "Okafor Distribution LLC", "Lindqvist Packaging", "Castellano Foods", "Holloway Freight Lines", "Northern Plains Fabrication", "Ferreira Plastics Inc.", "Abernathy Electrical Contractors", "Sato Tool & Die"];
const BIG_CO = ["Microsoft", "Amazon", "JPMorgan Chase", "Pfizer", "Deloitte", "Accenture", "Oracle", "Caterpillar", "General Electric", "Salesforce"];
const OTHER_CO = ["Brightline Analytics", "Cedar Grove Hospital", "Riverton University", "Apex Talent Partners", "Sunrise Wealth Advisors", "Bluefin SaaS", "Meridian Law LLP", "Harbor Community Foundation", "Stealth Startup", "Vantage Marketing Agency"];

const TARGET_POS = ["President & Owner", "Chief Operating Officer", "CEO", "Chief of Staff", "Managing Director", "President", "Owner / Managing Director", "COO", "Chief Executive Officer", "Chief of Staff to the CEO"];
const OTHER_EXEC = ["VP of Sales", "SVP Operations", "Chief Financial Officer", "General Manager", "VP Supply Chain", "EVP, Manufacturing"];
const NON_EXEC = ["Software Engineer", "Marketing Manager", "Plant Manager", "Account Executive", "Senior Analyst", "Operations Coordinator", "Director of HR", "Controller"];
const DISQ = ["Talent Acquisition Partner", "Senior Recruiter", "MBA Candidate at Riverton University", "Seeking new opportunities", "Founder, stealth pre-revenue startup", "Student at Riverton University", "Growth Consultant helping executives get 10x leads"];

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const TODAY = new Date(Date.UTC(2026, 8, 21));
function fmtConnected(d: Date) {
  return `${d.getUTCDate()} ${MON[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
function fmtSent(d: Date) {
  const h = d.getUTCHours();
  const ap = h >= 12 ? "PM" : "AM";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}, ${hh}:${String(d.getUTCMinutes()).padStart(2, "0")} ${ap}`;
}
function daysAgo(n: number) {
  return new Date(TODAY.getTime() - n * 86400000 + Math.floor(rnd() * 86400000));
}
const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

interface Conn { first: string; last: string; url: string; email: string; company: string; position: string; connectedOn: string }
const conns: Conn[] = [];
const usedUrls = new Set<string>();
let emptyPosition = 0, emptyCompany = 0, withEmail = 0, withCreds = 0;
for (let i = 0; i < 120; i++) {
  const first = pick(FIRST);
  let last = pick(LAST);
  let url = `https://www.linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase().replace(/ø/g, "o")}-${(1000 + i).toString(36)}`;
  while (usedUrls.has(url)) url += "x";
  usedUrls.add(url);
  const r = rnd();
  let position = r < 0.3 ? pick(TARGET_POS) : r < 0.45 ? pick(OTHER_EXEC) : r < 0.8 ? pick(NON_EXEC) : pick(DISQ);
  const rc = rnd();
  let company = rc < 0.45 ? pick(FAMILY_CO) : rc < 0.7 ? pick(BIG_CO) : pick(OTHER_CO);
  if (i % 10 === 3) { position = ""; emptyPosition++; }
  if (i % 17 === 5) { company = ""; emptyCompany++; }
  if (i % 23 === 7) { last = `${last}, ${pick(CREDS)}`; withCreds++; }
  const email = i % 8 === 1 ? `${first.toLowerCase()}.${last.split(",")[0].toLowerCase()}@example.com` : "";
  if (email) withEmail++;
  // Spread: some under 1 year, some 1–3 years, some 3+ years.
  const days = i % 3 === 0 ? Math.floor(rnd() * 360) : i % 3 === 1 ? 365 + Math.floor(rnd() * 700) : 1100 + Math.floor(rnd() * 1500);
  conns.push({ first, last, url, email, company, position, connectedOn: fmtConnected(daysAgo(days)) });
}

const preamble = [
  "Notes:",
  '"When exporting your connection data, you may notice that some of the email addresses are missing. You will only see email addresses for connections who have allowed their connections to see or download their email address using this setting https://www.linkedin.com/psettings/privacy/email. You can learn more here https://www.linkedin.com/help/linkedin/answer/261"',
  "",
].join("\n");
const connCsv = preamble + "\n" + "First Name,Last Name,URL,Email Address,Company,Position,Connected On\n" +
  conns.map((c) => [c.first, c.last, c.url, c.email, c.company, c.position, c.connectedOn].map(esc).join(",")).join("\n") + "\n";
writeFileSync(join(OUT, "Connections.csv"), connCsv);

// Invitations: 40 INCOMING (12 with messages), 20 OUTGOING (10 accepted = invitee URL in Connections).
const ME = "Radar Owner";
const MSGS: [string, string][] = [
  ["sell", "Hi {name}, I run a lead-gen agency and can book you 20 qualified meetings a month. Free to jump on a 15-minute call this week?"],
  ["sell", "We help CIOs cut cloud spend by 30% with our platform. Would love to show you a quick demo."],
  ["network", "Enjoyed your panel at the Manufacturing Leadership Summit last week. I run operations at a family-owned fabricator in Ohio and would like to stay in touch."],
  ["network", "Fellow COO here (regional distribution business, 400 staff). Your post on ERP carve-outs matched our situation exactly. Let's connect."],
  ["job", "I'm a recent graduate looking for my first role in technology consulting. Would you have 20 minutes to share advice on breaking in?"],
  ["job", "Currently between roles after a layoff. Would appreciate any referrals into your network for IT leadership positions."],
  ["fan", "I read every one of your newsletters on AI transformation. As a plant manager I'm learning a lot. Just wanted to follow along."],
  ["fan", "Your talk on SAP S/4HANA migrations changed how I think about sequencing. Thank you, connecting to keep learning."],
  ["spam", "Congratulations!!! You have been selected for an exclusive investment opportunity. Click here: http://bit.ly/xyz123"],
  ["spam", "Hello dear, I am a widow with a large inheritance and need a trusted partner."],
  ["network", "I'm the President and owner of a 250-person precision machining company. We met at the NTMA conference. Would be good to compare notes."],
  ["sell", "Our recruiting firm places CIOs and CTOs. Are you open to hearing about roles we are working on?"],
];
interface Inv { from: string; to: string; sentAt: string; message: string; direction: "INCOMING" | "OUTGOING"; inviter: string; invitee: string }
const invs: Inv[] = [];
let withoutMessage = 0, incoming = 0, outgoing = 0, outAccepted = 0, outPending = 0, incomingAccepted = 0;
const me = "https://www.linkedin.com/in/radar-owner";
for (let i = 0; i < 40; i++) {
  const first = pick(FIRST), last = pick(LAST);
  // 6 incoming inviters are already connections (accepted); rest are new (pending).
  const existing = i < 6 ? conns[i * 7] : null;
  const name = existing ? `${existing.first} ${existing.last.split(",")[0]}` : `${first} ${last}`;
  const inviter = existing ? existing.url : `https://www.linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-in${i}`;
  if (existing) incomingAccepted++;
  const msg = i < 12 ? MSGS[i][1].replace("{name}", ME.split(" ")[0]) : "";
  if (!msg) withoutMessage++;
  incoming++;
  const days = i % 3 === 0 ? Math.floor(rnd() * 6) : i % 3 === 1 ? 8 + Math.floor(rnd() * 20) : 40 + Math.floor(rnd() * 200);
  invs.push({ from: name, to: ME, sentAt: fmtSent(daysAgo(days)), message: msg, direction: "INCOMING", inviter, invitee: me });
}
for (let i = 0; i < 20; i++) {
  const accepted = i < 10;
  const c = accepted ? conns[50 + i] : null;
  const first = pick(FIRST), last = pick(LAST);
  const name = c ? `${c.first} ${c.last.split(",")[0]}` : `${first} ${last}`;
  const invitee = c ? c.url : `https://www.linkedin.com/in/${first.toLowerCase()}-${last.toLowerCase()}-out${i}`;
  if (accepted) outAccepted++; else outPending++;
  outgoing++;
  withoutMessage += 1;
  invs.push({ from: ME, to: name, sentAt: fmtSent(daysAgo(Math.floor(rnd() * 120))), message: "", direction: "OUTGOING", inviter: me, invitee });
}
// Shuffle order to look like an export (newest first is typical, but order is not relied upon).
invs.sort(() => rnd() - 0.5);
const invCsv = "From,To,Sent At,Message,Direction,inviterProfileUrl,inviteeProfileUrl\n" +
  invs.map((v) => [v.from, v.to, v.sentAt, v.message, v.direction, v.inviter, v.invitee].map(esc).join(",")).join("\n") + "\n";
writeFileSync(join(OUT, "Invitations.csv"), invCsv);

// A LinkedIn file that matches neither schema (messages export) for the rejection test.
writeFileSync(join(OUT, "messages.csv"), "CONVERSATION ID,CONVERSATION TITLE,FROM,SENDER PROFILE URL,TO,DATE,SUBJECT,CONTENT,FOLDER\nabc,,Someone,https://www.linkedin.com/in/someone,Radar Owner,2026-09-01 10:00 UTC,,Hello,INBOX\n");

const expected = {
  connections: { rows: conns.length, emptyPosition, emptyCompany, withEmail, withCreds, preambleLines: 3, rawDataLines: conns.length },
  invitations: { rows: invs.length, incoming, outgoing, withoutMessage, withMessage: invs.length - withoutMessage, outgoingAccepted: outAccepted, outgoingPending: outPending, incomingAccepted, incomingPending: incoming - incomingAccepted, rawDataLines: invs.length },
};
writeFileSync(join(OUT, "expected.json"), JSON.stringify(expected, null, 2));
console.log(JSON.stringify(expected));
