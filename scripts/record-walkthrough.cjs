// Records a ~2 minute 1080p walkthrough of the running dashboard.
// Usage: start `npm run dev`, then `node scripts/record-walkthrough.cjs`.
// Output: launch/walkthrough/liferaft-walkthrough.webm
// No subtitles. Every number shown comes from the dashboard's own verified
// data (saved drills + the hosted live journal).
const { chromium } = require("@playwright/test");
const fs = require("node:fs/promises");
const path = require("node:path");

const URL = process.env.LIFERAFT_CAPTURE_URL || "http://127.0.0.1:3000/";
const OUT = path.resolve("launch/walkthrough");
const W = 1920, H = 1080;

(async () => {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.LIFERAFT_BROWSER === "chromium" ? undefined : "chrome", headless: true });
  const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, recordVideo: { dir: OUT, size: { width: W, height: H } } });
  await context.addInitScript(() => {
    const show = () => {
      if (document.getElementById("card")) return;
      const c = document.createElement("div");
      c.id = "card";
      c.setAttribute("style", "position:fixed;inset:0;z-index:100;background:#0f0f0e;color:#f2efe8;display:grid;place-items:center;text-align:center;transition:opacity 1s ease;font-family:system-ui");
      c.innerHTML = '<div><div style="font:13px monospace;letter-spacing:.16em;text-transform:uppercase;color:#ff4a1c;margin-bottom:28px">HackUTD · infrastructure reliability</div><h1 style="font:400 150px/1 var(--font-instrument),Georgia,serif;margin:0">Life<em style="color:#ff4a1c">raft</em></h1><p style="font-size:26px;color:#9c978c;margin:18px 0 0">When the hardware fails, the training doesn&rsquo;t.</p></div>';
      document.documentElement.appendChild(c);
    };
    if (sessionStorage.getItem("lr-card-done")) return;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", show); else show();
  });
  const page = await context.newPage();
  const wait = (ms) => page.waitForTimeout(ms);

  // Caption overlay + smooth scroll helpers, installed into the page.
  const install = () => page.evaluate(() => {
    if (window.__cap) return;
    const style = document.createElement("style");
    style.textContent = `
      #cap{position:fixed;left:50%;bottom:56px;transform:translate(-50%,12px);z-index:99;opacity:0;
        transition:opacity .6s ease,transform .6s ease;pointer-events:none;text-align:center;
        background:rgba(15,15,14,.86);color:#f2efe8;backdrop-filter:blur(10px);padding:20px 38px;border-radius:999px;
        font:500 31px/1.3 var(--font-geist),system-ui;max-width:1500px;letter-spacing:-.01em;box-shadow:0 20px 60px rgba(0,0,0,.25)}
      #cap.on{opacity:1;transform:translate(-50%,0)}
      #cap em{font-family:var(--font-instrument),Georgia,serif;font-style:italic;color:#ff4a1c;font-size:1.12em}
      #cap small{display:block;font:400 13px var(--font-geist-mono),monospace;color:#9c978c;margin-top:4px;letter-spacing:.06em;text-transform:uppercase}
      #card{position:fixed;inset:0;z-index:100;background:#0f0f0e;color:#f2efe8;display:grid;place-items:center;text-align:center;
        transition:opacity 1s ease;font-family:var(--font-geist),system-ui}
      #card.off{opacity:0;pointer-events:none}
      #card h1{font:400 150px/1 var(--font-instrument),Georgia,serif;margin:0;letter-spacing:-.02em}
      #card h1 em{color:#ff4a1c}
      #card p{font-size:26px;color:#9c978c;margin:18px 0 0}
      #card .k{font:13px var(--font-geist-mono),monospace;letter-spacing:.16em;text-transform:uppercase;color:#ff4a1c;margin-bottom:28px}`;
    document.head.appendChild(style);
    const cap = document.createElement("div");
    cap.id = "cap";
    document.body.appendChild(cap);
    window.__cap = (html) => {
      cap.classList.remove("on");
      setTimeout(() => { cap.innerHTML = html; if (html) cap.classList.add("on"); }, html ? 350 : 0);
    };
    window.__card = (html) => {
      let c = document.getElementById("card");
      if (!c) { c = document.createElement("div"); c.id = "card"; document.body.appendChild(c); }
      if (html) { c.innerHTML = `<div>${html}</div>`; c.classList.remove("off"); } else c.classList.add("off");
    };
    window.__glide = (y, ms = 1800) => new Promise((done) => {
      document.documentElement.style.scrollBehavior = "auto";
      const from = window.scrollY, to = Math.max(0, Math.min(y, document.documentElement.scrollHeight - innerHeight)), t0 = performance.now();
      const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
      const step = (now) => { const t = Math.min(1, (now - t0) / ms); scrollTo(0, from + (to - from) * ease(t)); t < 1 ? requestAnimationFrame(step) : done(); };
      requestAnimationFrame(step);
    });
  });
  // No subtitles: the dashboard tells the story on its own.
  const cap = async () => {};
  const card = (html) => page.evaluate((h) => window.__card(h), html);
  const glideTo = (sel, offset = -70, ms = 1800) =>
    page.evaluate(([s, o, m]) => { const el = document.querySelector(s); return el ? window.__glide(el.getBoundingClientRect().top + scrollY + o, m) : null; }, [sel, offset, ms]);
  const mouseSweep = async (y) => { for (let x = 300; x <= W - 300; x += 60) { await page.mouse.move(x, y + Math.sin(x / 140) * 40); await wait(28); } };

  await page.goto(URL, { waitUntil: "networkidle", timeout: 60000 });
  await install();
  // Pin replay first: the story plays from saved, verified drills.
  await page.getByRole("button", { name: "Replay", exact: true }).click();
  await page.waitForSelector("#status", { timeout: 30000 });
  await page.evaluate(() => scrollTo(0, 0));

  // 0:00 title card (already on screen from first paint)
  await page.evaluate(() => sessionStorage.setItem("lr-card-done", "1"));
  await wait(2600);
  await card("");
  await wait(1200);

  // 0:05 hero
  await cap(`AI training runs for days. One overheating node can erase <em>hours</em> of work.`);
  await mouseSweep(420);
  await wait(2600);
  await cap(`Liferaft <em>predicts</em> the failure, <em>moves</em> the job, and <em>proves</em> nothing was lost.`);
  await mouseSweep(520);
  await wait(2400);

  // 0:15 status + play the cooling drill
  await glideTo("#status");
  await cap(`Every number here is real: training steps, checkpoints, hashes.<small>faults are injected on purpose and labelled</small>`);
  await wait(3500);
  await page.getByRole("button", { name: /Play the story/ }).click();
  await cap(`Drill: a cooling fault. Watch the temperature climb.`);
  await glideTo("#fleet", -70, 1500);
  await wait(3500);
  await cap(`The orange marker is the machine that <em>owns</em> the job.`);
  await wait(4500);
  await cap(`Heat trend crosses the limit in ~52 s. Liferaft acts <em>before</em> the machine dies.`);
  await wait(5000);
  await cap(`Safe copy saved, ownership moves, the old machine is <em>fenced out</em>.`);
  await wait(6000);
  await cap(`The next real optimizer step runs on the standby. <em>That</em> is the proof.`);
  await wait(4500);

  // 0:45 story + charts
  await glideTo("#story", -70, 1800);
  await cap(`A plain-language timeline anyone on shift can follow.`);
  await wait(3600);
  await page.evaluate(() => window.__glide(document.querySelector("#story .stack").getBoundingClientRect().top + scrollY - 90, 1400));
  await cap(`One learning curve, two machines. It matches an uninterrupted <em>ghost run</em> exactly.`);
  await wait(5500);

  // 0:57 guards
  await glideTo("#guards", -70, 1800);
  await cap(`Why not just save to a database? Because saving is the <em>easy 10%</em>.`);
  await wait(4200);
  await page.evaluate(() => window.__glide(document.querySelector("#guards .guards").getBoundingClientRect().top + scrollY - 260, 1200));
  await cap(`When to move · who may write · is the copy good · did it really resume.`);
  await wait(5000);

  // 1:08 other failure modes
  await glideTo("#status", -70, 1600);
  await page.getByRole("button", { name: /Zombie machine/ }).click();
  await cap(`Other failures, same guarantees: a <em>zombie</em> primary tries to write after losing its lease.`);
  await wait(2400);
  await page.getByRole("button", { name: /Play the story/ }).click();
  await glideTo("#story", -70, 1600);
  await wait(4500);
  await cap(`Its expired epoch is refused. Only one machine can ever write.`);
  await wait(4500);

  // 1:25 ops
  await glideTo("#ops", -70, 1800);
  await cap(`An AI ops agent investigates with <em>read-only</em> tools. Code, not the model, decides.`);
  await wait(5000);
  await cap(`The on-call engineer is told in plain words, with replies that can't bypass safety.`);
  await wait(4000);

  // 1:35 after
  await page.evaluate(() => window.__glide(document.querySelector("#ops").getBoundingClientRect().bottom + scrollY - 40, 1600));
  await cap(`A shift handoff brief built only from verified events, and what downtime would have cost.`);
  await wait(5000);

  // 1:42 live hardware
  await cap("");
  await page.evaluate(() => window.__glide(0, 1200));
  await page.getByRole("button", { name: "Live", exact: true }).click();
  await wait(2500);
  await glideTo(".live-ctl", -90, 1200);
  await cap(`And it runs on real hardware: Raspberry Pi → Windows laptop, triggered by an ESP32 button.`);
  await wait(4500);
  await glideTo("#fleet", -70, 1500);
  await cap(`Live record from the hosted coordinator: the Pi handed off and training <em>continued</em>.`);
  await wait(5000);

  // 1:55 close
  await cap("");
  await page.evaluate(() => window.__glide(document.documentElement.scrollHeight, 2200));
  await wait(3200);
  await card(`<h1>Fail fast. <em>Lose nothing.</em></h1><p>Liferaft · predict · evacuate · prove · brief</p>`);
  await wait(4200);

  const video = page.video();
  await context.close();
  await browser.close();
  const src = await video.path();
  const dest = path.join(OUT, "liferaft-walkthrough.webm");
  await fs.rm(dest, { force: true });
  await fs.rename(src, dest);
  const { size } = await fs.stat(dest);
  console.log(JSON.stringify({ video: dest, mb: +(size / 1e6).toFixed(1) }));
})().catch((e) => { console.error(e); process.exitCode = 1; });
