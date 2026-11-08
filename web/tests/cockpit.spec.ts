import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import local from "../fixtures/replay.local-job.json";

test("real API verifies evidence, keeps localhost boundary and security headers", async ({
  request,
}) => {
  const response = await request.get("/api/replay");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  const { replay } = await response.json();
  expect(replay.job).toBe("local-job");
  expect(replay.recovery.verified_resumed).toBe(true);
  const denied = await request.get("/api/replay", {
    headers: { host: "example.com" },
  });
  expect(denied.status()).toBe(403);
  const page = await request.get("/");
  expect(page.headers()["x-content-type-options"]).toBe("nosniff");
  expect(page.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
});

const cards = [
  ["Explore recovery proof", "How do we know it worked?"],
  ["Explore workers and handoff", "Who did the work?"],
  ["Explore the incident and event log", "What happened, in order?"],
  ["Explore training progress and checkpoints", "What progress was saved?"],
  [
    "Explore the handoff brief and investigation",
    "What should the next person know?",
  ],
] as const;

test("five cards open technical evidence in place and restore focus", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?gl=off");
  await expect(page.locator("#outcome-title")).toHaveText(
    "The workkept going.",
  );
  for (const [name, title] of cards) {
    const opener = page.getByRole("button", { name, exact: true });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: title, exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator(".detail-intro p")).not.toBeEmpty();
    await expect(page).toHaveURL(/\/$|\?/);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(opener).toBeFocused();
  }
  expect(errors).toEqual([]);
});
test("cursor, filters, raw evidence, deep links and re-verification remain linked", async ({
  page,
}) => {
  await page.goto("/?gl=off");
  await expect(page.locator("#outcome-title")).toContainText("kept going.");
  await page.getByRole("button", { name: "First event", exact: true }).click();
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveValue("1");
  await page.getByRole("button", { name: cards[2][0] }).click();
  await page.getByRole("button", { name: "All events", exact: true }).click();
  await page
    .getByLabel("Filter source", { exact: true })
    .selectOption("injected");
  await expect(page.locator(".event-list")).toContainText("Cooling drill");
  await page
    .locator(".event-row")
    .filter({ hasText: "Cooling drill" })
    .first()
    .click();
  await expect(page.locator(".selected-evidence")).toContainText("injected");
  await page
    .getByText("Open the technical record (JSON)", { exact: true })
    .click();
  await expect(page.locator(".selected-evidence pre")).toContainText(
    "RESCUE_REQUESTED",
  );
  const value = await page.getByRole("slider").inputValue();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Re-verify saved evidence" }).click();
  await expect(
    page.getByRole("button", { name: "Re-verify saved evidence" }),
  ).toBeEnabled();
  await expect(page.getByRole("slider")).toHaveValue(value);
  await page.reload();
  await expect(page.getByRole("slider")).toHaveValue(value);
});
for (const width of [1920, 1440, 1280, 768, 390, 320])
  test(`balanced responsive overview and accessibility ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/?gl=off");
    await expect(page.locator("#outcome-title")).toContainText("kept going.");
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width >= 1280) {
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight + 2,
        ),
      ).toBe(true);
      const areas = await page.locator(".bento").evaluateAll((nodes) =>
        nodes.map((n) => {
          const b = n.getBoundingClientRect();
          return b.width * b.height;
        }),
      );
      expect(Math.max(...areas) / Math.min(...areas)).toBeLessThan(1.06);
    }
    const issues = (await new AxeBuilder({ page }).analyze()).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      issues.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
    ).toEqual([]);
    const backgrounds = await page
      .locator("body,.bento,.dashboard-header")
      .evaluateAll((nodes) =>
        nodes.map((n) => getComputedStyle(n).backgroundImage),
      );
    expect(backgrounds.every((b) => b === "none")).toBe(true);
    await page.screenshot({
      path: `.liferaft/bento-${width}.png`,
      fullPage: true,
    });
  });
for (const state of [
  "empty",
  "forbidden",
  "unverified",
  "network",
  "simulated",
  "single-sample",
  "unknown-recovery",
])
  test(`honest ${state} state`, async ({ page }) => {
    await page.route("**/api/replay", async (route) => {
      if (state === "network") {
        await route.abort();
        return;
      }
      const replay =
        state === "empty"
          ? null
          : state === "simulated"
            ? {
                ...local,
                events: local.events.map((e, i) =>
                  i === 0 ? { ...e, source: "simulated" } : e,
                ),
              }
            : state === "single-sample"
              ? {
                  ...local,
                  losses: local.losses.filter((s) => s.origin === "journal"),
                }
              : state === "unknown-recovery"
                ? {
                    ...local,
                    recovery: {
                      ...local.recovery,
                      verified_resumed: false,
                      completed_after_resume: false,
                      rpo_steps: null,
                      rto_ms: null,
                    },
                  }
                : local;
      await route.fulfill({
        status:
          state === "forbidden" ? 403 : state === "unverified" ? 422 : 200,
        contentType: "application/json",
        body: JSON.stringify({ replay }),
      });
    });
    await page.goto("/?gl=off");
    if (state === "empty")
      await expect(page.locator("#outcome-title")).toContainText(
        "work matters.",
      );
    else if (["forbidden", "unverified", "network"].includes(state))
      await expect(page.locator(".dashboard-alert")).toBeVisible();
    else if (state === "simulated")
      await expect(page.locator(".simulation-notice")).toContainText(
        "SIMULATED",
      );
    else if (state === "single-sample") {
      await expect(page.locator(".progress-bottom")).toContainText(
        "One recorded measurement",
      );
      await expect(page.locator(".progress-graphic circle")).toHaveCount(1);
    } else {
      await expect(page.locator("#outcome-title")).toContainText(
        "Still unknown.",
      );
      await expect(page.locator(".saved-updates strong")).toHaveText("—");
      await expect(page.locator("#incident-title")).not.toContainText(
        "A real handoff",
      );
    }
  });
test("handoff clipboard, print, devices and plain-language help", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?gl=off");
  await page.getByRole("button", { name: cards[4][0] }).click();
  await page.getByRole("button", { name: "Copy text", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "HANDOFF BRIEF",
  );
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".handoff")).toBeVisible();
  await expect(page.locator(".dashboard-header")).not.toBeVisible();
  await page.pdf({ path: ".liferaft/bento-handoff.pdf" });
  await page.emulateMedia({ media: "screen" });
  await page
    .getByRole("button", { name: "Devices & messages", exact: true })
    .click();
  await expect(page.locator(".detail-dialog")).toContainText(
    "No delivery or acknowledgement evidence",
  );
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "How to read this" }).click();
  await expect(page.getByRole("dialog")).toContainText("Start with the story.");
  await page.getByRole("button", { name: "Got it" }).click();
});
test("mobile detail focus stays contained and technical tabs are accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?gl=off");
  const opener = page.getByRole("button", { name: cards[2][0] });
  await opener.click();
  for (let i = 0; i < 18; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest("dialog[open]"),
      ),
    ).toBe(true);
  }
  const issues = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    issues.map((v) => ({ id: v.id, nodes: v.nodes.map((n) => n.target) })),
  ).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});
test("technical WebGL is an enhancement with context recovery and no shader errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /Shader|WebGLProgram|GL_INVALID/.test(m.text()))
      errors.push(m.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?gl=lose");
  await page.getByRole("button", { name: cards[1][0] }).click();
  await expect(page.locator(".topo-status")).toContainText(
    /WebGL|3D unavailable/,
    { timeout: 20000 },
  );
  if (await page.locator("canvas.topo-canvas").count())
    await expect(page.locator("canvas.topo-canvas")).toHaveAttribute(
      "data-context-restores",
      "1",
    );
  expect(errors).toEqual([]);
});
