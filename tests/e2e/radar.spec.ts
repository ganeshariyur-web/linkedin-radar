import { expect, test, type Page, type Request } from "@playwright/test";
import { readFileSync } from "node:fs";
import path from "node:path";

const FX = path.resolve("fixtures");
const expected = JSON.parse(readFileSync(path.join(FX, "expected.json"), "utf8"));
const CONTRACT_PRE_CONN = ["position", "company", "connected_for", "name_suffixes"];
const CONTRACT_PRE_INV = ["name", "message", "invitation_age"];

function urlKey(url: string) {
  return url.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[?#]/)[0].replace(/\/+$/, "");
}
function fixtureConnections() {
  const lines = readFileSync(path.join(FX, "Connections.csv"), "utf8").split("\n");
  const hi = lines.findIndex((l) => l.startsWith("First Name,Last Name"));
  return lines.slice(hi + 1).filter(Boolean).map((l) => {
    const c = l.split(","); // fixture rows have no embedded commas except credentials in quotes
    // Re-join quoted last names ("Okafor, MBA")
    const cells: string[] = [];
    let cur = "", inq = false;
    for (const ch of l) { if (ch === '"') inq = !inq; else if (ch === "," && !inq) { cells.push(cur); cur = ""; } else cur += ch; }
    cells.push(cur);
    return { url: cells[2], position: cells[5], raw: c };
  });
}

async function uploadBoth(page: Page) {
  await page.goto("/");
  await page.getByTestId("input-connections").setInputFiles(path.join(FX, "Connections.csv"));
  await expect(page.getByTestId("stats-connections")).toBeVisible();
  await page.getByTestId("input-invitations").setInputFiles(path.join(FX, "Invitations.csv"));
  await expect(page.getByTestId("stats-invitations")).toBeVisible();
}

async function uploadBothAndContinue(page: Page) {
  await uploadBoth(page);
  await page.getByTestId("continue").click();
  await expect(page.getByTestId("upload-bar")).toBeVisible();
}

test.describe("upload", () => {
  test("skips the preamble, parsed count matches raw lines, both date formats, counts", async ({ page }) => {
    await uploadBoth(page);
    const c = page.getByTestId("stats-connections");
    await expect(c).toContainText(`${expected.connections.rows} of ${expected.connections.rawDataLines} raw lines`);
    await expect(c).toContainText("Day Month Year");
    await expect(c).toContainText("Preamble skipped");
    await expect(c).toContainText(`${expected.connections.preambleLines} lines`);
    const i = page.getByTestId("stats-invitations");
    await expect(i).toContainText(`${expected.invitations.rows} of ${expected.invitations.rawDataLines} raw lines`);
    await expect(i).toContainText("M/D/YY");
    await expect(i).toContainText(`${expected.invitations.incoming} / ${expected.invitations.outgoing}`);
    // Counts rendered as label/value pairs
    const text = await c.innerText();
    expect(text).toContain(String(expected.connections.emptyPosition));
    expect(text).toContain(String(expected.connections.emptyCompany));
    expect(text).toContain(String(expected.connections.withEmail));
    expect(await i.innerText()).toContain(String(expected.invitations.withoutMessage));
  });

  test("a file dropped in the wrong slot is moved and the user is told", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("input-connections").setInputFiles(path.join(FX, "Invitations.csv"));
    await expect(page.getByTestId("msg-connections")).toContainText("moved to the Invitations slot");
    await expect(page.getByTestId("stats-invitations")).toBeVisible();
    await expect(page.getByTestId("slot-connections")).toContainText("No file yet");
  });

  test("a file matching neither schema is rejected with the expected columns", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("input-connections").setInputFiles(path.join(FX, "messages.csv"));
    const msg = page.getByTestId("msg-connections");
    await expect(msg).toContainText("matches neither");
    await expect(msg).toContainText("First Name, Last Name, URL, Email Address, Company, Position, Connected On");
    await expect(msg).toContainText("From, To, Sent At, Message, Direction, inviterProfileUrl, inviteeProfileUrl");
  });
});

test.describe("scoring with live Jev", () => {
  test("connections run: empty Position → unknown → Tier 2; only contract fields sent; thresholds recompute without Jev", async ({ page }) => {
    const bodies: { url: string; body: unknown }[] = [];
    page.on("request", (r: Request) => { if (r.url().includes("/api/score") && r.method() === "POST") bodies.push({ url: r.url(), body: r.postDataJSON() }); });
    await uploadBothAndContinue(page);
    // Collapsed bar with both filenames and counts
    const bar = page.getByTestId("upload-bar");
    await expect(bar).toContainText("Connections.csv");
    await expect(bar).toContainText("Invitations.csv");
    await expect(bar).toContainText(`${expected.connections.rows} rows`);

    await page.getByTestId("run").click();
    await expect(page.getByTestId("run")).toContainText("nothing pending", { timeout: 170_000 });

    // Every request carried only contract fields and ≤ 50 rows, and only connection rows.
    expect(bodies.length).toBeGreaterThan(0);
    for (const { body } of bodies) {
      const b = body as { tab: string; rows: { id: string; state: Record<string, unknown> }[] };
      expect(b.tab).toBe("connections");
      expect(b.rows.length).toBeLessThanOrEqual(50);
      for (const r of b.rows) {
        expect(r.id.startsWith("c:")).toBe(true);
        for (const k of Object.keys(r.state)) expect(CONTRACT_PRE_CONN).toContain(k);
        expect(r.state).not.toHaveProperty("email");
        expect(r.state).not.toHaveProperty("url");
      }
    }
    const sent = bodies.reduce((n, { body }) => n + (body as { rows: unknown[] }).rows.length, 0);
    expect(sent).toBe(expected.connections.rows);

    // Empty-Position rows resolve to unknown and land in Tier 2, never Rejected.
    const empties = fixtureConnections().filter((r) => r.position === "");
    expect(empties.length).toBe(expected.connections.emptyPosition);
    for (const e of empties) {
      const tile = page.locator(`[data-row-id="c:${urlKey(e.url)}"]`).first();
      await expect(tile).toHaveAttribute("data-tier", "tier2");
    }
    await page.locator(`[data-row-id="c:${urlKey(empties[0].url)}"]`).first().click();
    await expect(page.getByTestId("answer-role")).toContainText("unknown");
    await expect(page.getByTestId("verifying")).toContainText("Tier 2");

    // Tier counts sum to rows and Rejected never includes an empty-position row.
    const t1 = Number(await page.locator('[data-testid="count-tier1"] [data-count]').getAttribute("data-count"));
    const t2 = Number(await page.locator('[data-testid="count-tier2"] [data-count]').getAttribute("data-count"));
    const t3 = Number(await page.locator('[data-testid="count-tier3"] [data-count]').getAttribute("data-count"));
    const rj = Number(await page.locator('[data-testid="count-rejected"] [data-count]').getAttribute("data-count"));
    expect(t1 + t2 + t3 + rj).toBe(expected.connections.rows);
    expect(t2).toBeGreaterThanOrEqual(expected.connections.emptyPosition);
    console.log(`TIERS tier1=${t1} tier2=${t2} tier3=${t3} rejected=${rj} requests=${bodies.length}`);

    // Threshold change recomputes with no new Jev calls.
    const before = bodies.length;
    await page.goto("/studio");
    await expect(page.getByTestId("thresholds")).toBeVisible();
    const liveT1Before = Number(await page.getByTestId("live-tier1").innerText());
    await page.getByTestId("slider-t1RoleConfidence").fill("0.99");
    await expect(page.getByTestId("th-t1RoleConfidence")).toHaveText("0.99");
    await page.getByTestId("slider-rejectedDisqualifiedMin").fill("0.99");
    await page.waitForTimeout(500);
    const liveT1After = Number(await page.getByTestId("live-tier1").innerText());
    const liveRejAfter = Number(await page.getByTestId("live-rejected").innerText());
    console.log(`THRESHOLDS live tier1 ${liveT1Before} → ${liveT1After}; rejected → ${liveRejAfter}`);
    expect(bodies.length).toBe(before);
    expect(liveT1After).toBeLessThanOrEqual(liveT1Before);
    // Restore
    await page.getByTestId("slider-t1RoleConfidence").fill("0.7");
    await page.getByTestId("slider-rejectedDisqualifiedMin").fill("0.7");
    expect(bodies.length).toBe(before);
  });

  test("invitations run: message-less rows never reach Jev; outgoing rows match against Connections", async ({ page }) => {
    const bodies: unknown[] = [];
    page.on("request", (r: Request) => { if (r.url().includes("/api/score") && r.method() === "POST") bodies.push(r.postDataJSON()); });
    await uploadBothAndContinue(page);
    await page.getByTestId("tab-invitations").click();
    await expect(page.getByTestId("tier-counts")).toContainText(`Outgoing accepted ${expected.invitations.outgoingAccepted}`);
    await expect(page.getByTestId("tier-counts")).toContainText(`pending ${expected.invitations.outgoingPending}`);
    const noSignal = Number(await page.locator('[data-testid="count-no_signal"] [data-count]').getAttribute("data-count"));
    expect(noSignal).toBe(expected.invitations.incoming - expected.invitations.withMessage);
    await page.getByTestId("run").click();
    await expect(page.getByTestId("run")).toContainText("nothing pending", { timeout: 120_000 });
    let sent = 0;
    for (const body of bodies) {
      const b = body as { tab: string; rows: { id: string; state: Record<string, unknown> }[] };
      expect(b.tab).toBe("invitations");
      for (const r of b.rows) {
        sent++;
        expect(r.id.startsWith("i:incoming:")).toBe(true);
        expect(String(r.state.message ?? "").length).toBeGreaterThan(0);
        for (const k of Object.keys(r.state)) expect(CONTRACT_PRE_INV).toContain(k);
      }
    }
    expect(sent).toBe(expected.invitations.withMessage);
    const acc = Number(await page.locator('[data-testid="count-accept"] [data-count]').getAttribute("data-count"));
    const rev = Number(await page.locator('[data-testid="count-review"] [data-count]').getAttribute("data-count"));
    const ign = Number(await page.locator('[data-testid="count-ignore"] [data-count]').getAttribute("data-count"));
    console.log(`INVITATIONS accept=${acc} review=${rev} ignore=${ign} no_signal=${noSignal} sent_to_jev=${sent}`);
    expect(acc + rev + ign).toBe(expected.invitations.withMessage);
  });
});

test("the scoring route rejects an invalid question spec and non-contract fields", async ({ request }) => {
  const good = { id: "role", type: "choice", tab: "connections", pass: "pre", enabled: true, instructions: "x", fields: ["position"], options: [{ key: "a", description: "A" }, { key: "b", description: "B" }] };
  const r1 = await request.post("/api/score", { data: { tab: "connections", pass: "pre", questions: [{ ...good, options: [{ key: "a", description: "A" }] }], rows: [{ id: "c:1", state: { position: "CEO" } }] } });
  expect(r1.status()).toBe(422);
  const r2 = await request.post("/api/score", { data: { tab: "connections", pass: "pre", questions: [{ ...good, fields: ["location"] }], rows: [{ id: "c:1", state: { position: "CEO" } }] } });
  expect(r2.status()).toBe(422);
  const r3 = await request.post("/api/score", { data: { tab: "connections", pass: "pre", questions: [good], rows: [{ id: "c:1", state: { position: "CEO", location: "Ohio" } }] } });
  expect(r3.status()).toBe(422);
  const r4 = await request.post("/api/score", { data: { tab: "connections", pass: "pre", questions: [good], rows: Array(51).fill({ id: "c:1", state: { position: "CEO" } }) } });
  expect(r4.status()).toBe(413);
});

test("methods and studio pages render the active preset and contract", async ({ page }) => {
  await page.goto("/methods");
  await expect(page.getByTestId("methods")).toContainText("role");
  await expect(page.getByTestId("methods")).toContainText("harvestapi/linkedin-profile-scraper");
  await expect(page.getByTestId("methods")).toContainText("Forbidden in any pre-enrichment question");
  await page.goto("/studio");
  await expect(page.getByTestId("qcard-role")).toBeVisible();
  await expect(page.getByTestId("contract")).toContainText("name_suffixes");
});
