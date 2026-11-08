import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const feed = {
  job: "browser-test-job",
  mode: "cloud",
  notice: "Test response, not real device evidence.",
  checked_at: "2026-11-08T16:00:00Z",
  other_workers: [],
  devices: ["pi-primary", "laptop-standby"].map((worker, index) => ({
    worker,
    title: index ? "Windows computer" : "Raspberry Pi",
    state: "active",
    age_s: 1,
    rows: [
      {
        worker,
        job: "browser-test-job",
        at: "2026-11-08T16:00:00Z",
        kind: "TRAINING_STEP_COMPLETED",
        source: "measured",
        origin: "test input",
        metrics: {
          step_completed: index ? 21 : 20,
          loss: 0.0123,
          os: index ? "Windows" : "Linux",
        },
      },
    ],
  })),
};

test("live activity auto-selects job, separates devices and pauses updates", async ({
  page,
}) => {
  await page.route("**/api/worker-logs", (route) =>
    route.fulfill({ json: feed }),
  );
  await page.goto("/story");
  const logs = page.locator(".worker-logs");
  await expect(logs).toContainText("browser-test-job");
  await expect(
    page.getByRole("article", { name: "Raspberry Pi training logs" }),
  ).toContainText("step_completed=20");
  await expect(
    page.getByRole("article", { name: "Windows computer training logs" }),
  ).toContainText("step_completed=21");
  await page
    .getByRole("button", { name: "Pause updates", exact: true })
    .click();
  await expect(logs).toContainText("Displayed activity is frozen");
  await page.route("**/api/worker-logs", (route) =>
    route.fulfill({ status: 503, json: { error: "Log updates unavailable." } }),
  );
  await page
    .getByRole("button", { name: "Resume updates", exact: true })
    .click();
  await expect(logs).toContainText("Log updates unavailable");
  await expect(logs).toContainText("step_completed=20");
});

test("real activity endpoint keeps loopback boundary and no-store", async ({
  request,
}) => {
  const response = await request.get("/api/worker-logs");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect((await response.json()).devices).toHaveLength(2);
  expect(
    (
      await request.get("/api/worker-logs", {
        headers: { Host: "example.com" },
      })
    ).status(),
  ).toBe(403);
});

test("both dashboard routes include readable mobile device logs", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 900 });
  await page.route("**/api/worker-logs", (route) =>
    route.fulfill({ json: feed }),
  );
  for (const route of ["/story", "/"]) {
    await page.goto(route);
    await expect(
      page.getByRole("heading", { name: "Training activity", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const result = await new AxeBuilder({ page })
      .include(".worker-logs")
      .analyze();
    expect(
      result.violations.filter(
        (v) => v.impact === "serious" || v.impact === "critical",
      ),
    ).toEqual([]);
  }
});
