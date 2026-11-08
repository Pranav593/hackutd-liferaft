import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.LIFERAFT_BROWSER === "chromium" ? undefined : "chrome",
});
try {
  const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    }),
    page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /Shader|WebGLProgram|GL_INVALID/.test(message.text())
    )
      errors.push(message.text());
  });
  await page.goto("http://127.0.0.1:3000/?gl=3d");
  await page
    .getByRole("heading", { name: "Training survived.", level: 1 })
    .waitFor();
  await page.getByLabel("Graphics quality").selectOption("mid");
  await page.locator(".topo-stage").scrollIntoViewIfNeeded();
  await page.waitForFunction(() =>
    document.querySelector(".topo-status")?.textContent?.includes("WebGL"),
  );
  const read = () =>
    page.locator("canvas.topo-canvas").evaluate((c) => ({ ...c.dataset }));
  const start = Date.now(),
    samples = [],
    duration = 300000;
  await page.getByRole("button", { name: "First event", exact: true }).click();
  let advances = 0;
  while (Date.now() - start < duration) {
    await page
      .getByRole("button", {
        name: advances % 30 === 29 ? "First event" : "Next event",
        exact: true,
      })
      .click({ timeout: 5000 })
      .catch(async () =>
        page.getByRole("button", { name: "First event", exact: true }).click(),
      );
    await new Promise((resolve) => setTimeout(resolve, 300));
    advances++;
    if (!samples.length || Date.now() - start >= samples.length * 60000) {
      const sample = { elapsedMs: Date.now() - start, ...(await read()) };
      samples.push(sample);
      console.log(JSON.stringify(sample));
    }
  }
  await page.getByRole("button", { name: "Last event", exact: true }).click();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const idleBefore = await read();
  await new Promise((resolve) => setTimeout(resolve, 1500));
  const idleAfter = await read();
  const result = {
    durationMs: Date.now() - start,
    advances,
    samples,
    final: idleAfter,
    idleRenderCountStable: idleBefore.renderCount === idleAfter.renderCount,
    errors,
    note: "Real local Chrome WebGL, mid tier; not a hardware-class FPS benchmark.",
  };
  writeFileSync(".liferaft/cockpit-soak.json", JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result));
  if (errors.length || !result.idleRenderCountStable) process.exitCode = 1;
} finally {
  await browser.close();
}
