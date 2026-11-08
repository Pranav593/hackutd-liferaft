// Run against an already running production console, never a development server.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { basename, join } from "node:path";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.LIFERAFT_BROWSER === "chromium" ? undefined : "chrome",
});
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  await page.addInitScript(() => {
    window.__cockpitMetrics = { lcp: 0, cls: 0, shifts: [] };
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        window.__cockpitMetrics.lcp = e.startTime;
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((list) => {
      for (const e of list.getEntries())
        if (!e.hadRecentInput) {
          window.__cockpitMetrics.cls += e.value;
          window.__cockpitMetrics.shifts.push({
            value: e.value,
            sources: e.sources.map((s) => ({
              tag: s.node?.tagName,
              cls: s.node?.className,
              previous: s.previousRect.toJSON(),
              current: s.currentRect.toJSON(),
            })),
          });
        }
    }).observe({ type: "layout-shift", buffered: true });
  });
  await page.goto("http://127.0.0.1:3000/?gl=off");
  await page
    .getByRole("heading", { level: 1, name: "Training survived." })
    .waitFor();
  const base = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (e) => e.name.includes("/_next/static/") && e.name.endsWith(".js"),
      )
      .map((e) => e.name),
  );
  await page.getByRole("button", { name: "3D", exact: true }).click();
  await page.waitForFunction(() =>
    /WebGL|3D unavailable/.test(
      document.querySelector(".topo-status")?.textContent ?? "",
    ),
  );
  const all = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .filter(
        (e) => e.name.includes("/_next/static/") && e.name.endsWith(".js"),
      )
      .map((e) => e.name),
  );
  const size = (urls) =>
    urls.map((url) => {
      const name = basename(new URL(url).pathname);
      return {
        name,
        gzip: gzipSync(readFileSync(join("web/.next/static/chunks", name)))
          .length,
      };
    });
  const baseline = size(base),
    engine = size(all.filter((url) => !base.includes(url)));
  const metrics = await page.evaluate(() => window.__cockpitMetrics);
  await page.getByRole("button", { name: "First event", exact: true }).click();
  const times = [];
  for (let i = 0; i < 10; i++) {
    const start = performance.now();
    await page
      .getByRole("button", {
        name: i % 2 ? "Previous event" : "Next event",
        exact: true,
      })
      .click();
    times.push(performance.now() - start);
  }
  const report = {
    ...metrics,
    baseGzipBytes: baseline.reduce((n, c) => n + c.gzip, 0),
    engineGzipBytes: engine.reduce((n, c) => n + c.gzip, 0),
    baseChunks: baseline,
    engineChunks: engine,
    graphics: await page.locator(".topo-status").innerText(),
    clickRoundtripMs: times,
    note: "Local browser automation roundtrip is not field INP. This LCP includes local verifier latency. Targets: base<=120KB, engine<=200KB, LCP<1800ms, CLS=0.",
  };
  writeFileSync(
    ".liferaft/cockpit-budget.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
} finally {
  await browser.close();
}
