import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("story loads genuine evidence, reveals proof at cursor, and keeps replies read-only", async ({
  page,
}) => {
  await page.goto("/story");
  await expect(
    page.getByRole("button", { name: /Run the story/ }),
  ).toBeEnabled();
  await expect(page.getByText("Awaiting comparison")).toBeVisible();
  await expect(
    page.getByText("HASH CHAIN VERIFIED", { exact: false }),
  ).toBeVisible();
  const range = page.getByRole("slider", { name: "Replay position" });
  await range.fill((await range.getAttribute("max")) ?? "0");
  await expect(page.getByText("0.000000", { exact: true })).toBeVisible();
  await expect(page.getByText("Exact match ✓")).toBeVisible();
  await page.getByText("Under the hood", { exact: true }).click();
  await page.getByRole("button", { name: "ROLLBACK", exact: true }).click();
  await expect(
    page.getByText("ROLLBACK refused:", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Run the story/ }).click();
  await expect(page.getByRole("button", { name: /Pause story/ })).toBeVisible();
  await expect(page.getByText("Awaiting comparison")).toBeVisible();
});

test("four real scenarios and invalid scenario handling", async ({
  page,
  request,
}) => {
  for (const scenario of ["cooling", "crash", "corrupt", "zombie"]) {
    const response = await request.get(`/api/story?scenario=${scenario}`);
    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.chain_valid).toBe(true);
    expect(data.proof.max_divergence).toBe(0);
    expect(data.proof.weights_equal).toBe(true);
    expect(data.proof.compared_steps).toBe(100);
    if (scenario === "corrupt")
      expect(
        data.events.some(
          (e: { event_type: string }) => e.event_type === "CHECKPOINT_REJECTED",
        ),
      ).toBe(true);
    if (scenario === "zombie")
      expect(
        data.events.some(
          (e: { event_type: string }) =>
            e.event_type === "STALE_LEASE_REJECTED",
        ),
      ).toBe(true);
    if (["crash", "corrupt"].includes(scenario))
      expect(data.status.rpo_steps).toBeNull();
  }
  expect((await request.get("/api/story?scenario=../../.env")).status()).toBe(
    400,
  );
  expect(
    (
      await request.get("/api/story", { headers: { Host: "attacker.example" } })
    ).status(),
  ).toBe(403);
  await page.goto("/story");
  await page.getByRole("button", { name: /Zombie primary/ }).click();
  await expect(
    page.getByRole("button", { name: /Zombie primary/ }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.getByRole("button", { name: /Run the story/ }),
  ).toBeEnabled();
});

test("money estimate is editable and error state is explicit", async ({
  page,
}) => {
  await page.goto("/story");
  await page.getByText("Under the hood", { exact: true }).click();
  await page.getByLabel("$ / GPU-hour", { exact: true }).fill("0");
  await expect(page.locator(".story-money-number")).toContainText("$0");
  await page.route("**/api/story?*", (route) =>
    route.fulfill({
      status: 422,
      json: { error: "Verified rehearsal unavailable." },
    }),
  );
  await page.getByRole("button", { name: /Re-verify evidence/ }).click();
  await expect(page.locator(".story-error")).toContainText(
    "Verified rehearsal unavailable",
  );
  await expect(
    page.getByRole("button", { name: /Run the story/ }),
  ).toBeDisabled();
});

for (const width of [1440, 768, 390, 320]) {
  test(`story responsive accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/story");
    await expect(
      page.getByRole("button", { name: /Run the story/ }),
    ).toBeEnabled();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page }).analyze();
    expect(
      results.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  });
}

test("hands-free story reaches real proof and stops after 90 seconds", async ({
  page,
}) => {
  test.setTimeout(110_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/story");
  await expect(
    page.getByRole("button", { name: /Run the story/ }),
  ).toBeEnabled();
  await page.getByRole("button", { name: /Run the story/ }).click();
  await expect(
    page.getByRole("complementary", { name: "Presentation captions" }),
  ).toBeVisible();
  await expect(page.getByText("0.000000", { exact: true })).toBeVisible({
    timeout: 100_000,
  });
  await expect(page.getByRole("button", { name: /Run the story/ })).toBeVisible(
    { timeout: 10_000 },
  );
  const slider = page.getByRole("slider", { name: "Replay position" });
  expect(await slider.inputValue()).toBe(await slider.getAttribute("max"));
  expect(errors).toEqual([]);
  await page.screenshot({
    path: ".liferaft/story-playback-complete.png",
    fullPage: true,
  });
});

test("worker scene provides a readable fallback without WebGL", async ({
  browser,
}) => {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      id: string,
      ...args: unknown[]
    ) {
      if (id.includes("webgl")) return null;
      return Reflect.apply(original, this, [id, ...args]);
    } as typeof original;
  });
  const page = await context.newPage();
  await page.goto("/story");
  await expect(
    page.getByText("PRIMARY ─── verified checkpoint ─── STANDBY"),
  ).toBeVisible();
  await context.close();
});
