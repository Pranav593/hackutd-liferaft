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
test("linked navigation, filtering, deep links and reverification", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?gl=off");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Training survived.",
  );
  await expect(page.locator(".rescue-headline")).toContainText(
    "0 known steps lost",
  );
  await page.getByRole("button", { name: "First event", exact: true }).click();
  await expect(page.getByRole("slider", { name: "Replay event" })).toHaveValue(
    "0",
  );
  await page.getByRole("button", { name: "Next event", exact: true }).click();
  await expect(page.getByRole("slider")).toHaveValue("1");
  await expect(page).toHaveURL(/c=1/);
  await page.getByRole("button", { name: "All events", exact: true }).click();
  await page
    .getByLabel("Filter source", { exact: true })
    .selectOption("injected");
  await expect(page.locator(".event-list")).toContainText("Cooling drill");
  await page.getByRole("button", { name: /Re-verify/ }).click();
  await expect(page.getByRole("button", { name: /Re-verify/ })).toBeEnabled();
  await expect(page.getByRole("slider")).toHaveValue("1");
  await page.reload();
  await expect(page.getByRole("slider")).toHaveValue("1");
  await expect(page.locator(".mode-chip")).toContainText("REPLAY");
  expect(errors).toEqual([]);
});
for (const width of [1440, 768, 390, 320])
  test(`responsive and axe ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/?gl=off");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Training survived.",
    );
    await page.evaluate(() => document.fonts.ready);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    const violations = results.violations.filter(
      (v) => v.impact === "critical" || v.impact === "serious",
    );
    expect(
      violations.map((v) => ({
        id: v.id,
        nodes: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    await page.addStyleTag({
      content: ".numbered-section{content-visibility:visible!important}",
    });
    await page.screenshot({
      path: `.liferaft/cockpit-${width}.png`,
      fullPage: true,
    });
    if (width < 900) {
      await page.locator(".rescue-beat").first().click();
      await expect(
        page.getByRole("dialog", { name: "Incident inspector" }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("dialog", { name: "Incident inspector" }),
      ).not.toBeVisible();
    }
  });
for (const state of [
  "empty",
  "forbidden",
  "unverified",
  "network",
  "simulated",
  "single-sample",
])
  test(`designed ${state} state`, async ({ page }) => {
    await page.route("**/api/replay", async (route) => {
      if (state === "network") {
        await route.abort();
        return;
      }
      await route.fulfill({
        status:
          state === "forbidden" ? 403 : state === "unverified" ? 422 : 200,
        contentType: "application/json",
        body: JSON.stringify({
          replay:
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
                      losses: local.losses.filter(
                        (s) => s.origin === "journal",
                      ),
                    }
                  : local,
        }),
      });
    });
    await page.goto("/?gl=off");
    if (state === "empty")
      await expect(page.getByRole("heading", { level: 1 })).toContainText(
        "No saved evidence",
      );
    else if (["forbidden", "unverified", "network"].includes(state))
      await expect(page.locator(".mode-banner[role=alert]")).toBeVisible();
    else if (state === "simulated")
      await expect(page.locator(".mode-banner")).toContainText("SIMULATED");
    else
      await expect(page.locator(".chart-readout")).toContainText(
        "1 measured sample",
      );
    await page.addStyleTag({
      content: ".numbered-section{content-visibility:visible!important}",
    });
    await page.screenshot({
      path: `.liferaft/cockpit-${state}.png`,
      fullPage: true,
    });
  });
test("handoff copy, print and keyboard help", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/?gl=off");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Training survived.",
  );
  await page.getByRole("button", { name: "Copy text", exact: true }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain(
    "HANDOFF BRIEF",
  );
  await page.keyboard.press("?");
  await expect(page.locator("dialog[open]")).toContainText(
    "Keyboard shortcuts",
  );
  await page.keyboard.press("Escape");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator(".handoff")).toBeVisible();
  await expect(page.locator(".site-header")).not.toBeVisible();
  await page.pdf({ path: ".liferaft/handoff.pdf" });
});
test("WebGL lifecycle, or honest static fallback", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/?gl=leak-check");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Training survived.",
  );
  await expect(page.locator(".topo-status")).toContainText(
    /WebGL|3D unavailable/,
    { timeout: 20000 },
  );
  const canvas = page.locator("canvas.topo-canvas");
  if (await canvas.count())
    await expect(canvas).toHaveAttribute("data-leak-check", "passed");
  expect(errors).toEqual([]);
});
test("context recovery and reduced-motion WebGL accessibility", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Shader|WebGLProgram|GL_INVALID/.test(message.text())
    )
      errors.push(message.text());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?gl=lose");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Training survived.",
  );
  await expect(page.locator(".topo-status")).toContainText(
    /WebGL|3D unavailable/,
    { timeout: 15000 },
  );
  if (await page.locator("canvas.topo-canvas").count()) {
    await expect(page.locator("canvas.topo-canvas")).toHaveAttribute(
      "data-context-restores",
      "1",
    );
    const violations = (
      await new AxeBuilder({ page }).analyze()
    ).violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(violations.map((v) => v.id)).toEqual([]);
  }
  expect(errors).toEqual([]);
  await page.screenshot({
    path: ".liferaft/cockpit-webgl.png",
    fullPage: false,
  });
});
test("modal focus stays in inspector and restores opener", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?gl=off");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Training survived.",
  );
  const opener = page.locator(".rescue-beat").first();
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Incident inspector" });
  await expect(dialog).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(
        () => !!document.activeElement?.closest("[role=dialog]"),
      ),
    ).toBe(true);
  }
  const issues = (await new AxeBuilder({ page }).analyze()).violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(issues.map((v) => v.id)).toEqual([]);
  await page.keyboard.press("Escape");
  await expect(opener).toBeFocused();
});
