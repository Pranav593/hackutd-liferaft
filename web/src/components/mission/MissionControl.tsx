"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Replay } from "../../lib/replay";
import type { StoryData } from "../story/types";
import { derive, fromLive, fromStory, toolSummary, utcTime, type Ev } from "../../lib/mission";
import { LineChart, Legend } from "./Charts";
import { FleetMap } from "./FleetMap";
import "./mission.css";

type Role = "pi_primary" | "standby" | "gateway";
const roleNames: Record<Role, string> = { pi_primary: "Raspberry Pi", standby: "Windows laptop", gateway: "ESP32 bridge" };
type Snapshot = {
  ready: Partial<Record<Role, boolean>>;
  controlsEnabled: boolean;
  run: { job: string; phase: string; at: number; devices: Partial<Record<Role, { stage: string; at: number }>> } | null;
  job: string | null;
  replay: Replay | null;
  health: { state: string; owner: string | null; ready_for_drill: boolean; reasons: string[] } | null;
  providers: Record<string, string>;
};

const scenarios = [
  { id: "cooling", title: "Overheating", blurb: "Fan fails, heat climbs, we move before it dies" },
  { id: "crash", title: "Sudden crash", blurb: "Machine vanishes with no warning" },
  { id: "corrupt", title: "Corrupted save", blurb: "The newest backup is damaged" },
  { id: "zombie", title: "Zombie machine", blurb: "The 'dead' machine wakes up and tries to write" },
] as const;

const pause = (e: Ev) => (["WORKER_HEARTBEAT", "REHEARSAL_TELEMETRY", "PI_CPU_TELEMETRY", "AMBIENT_TELEMETRY", "FAILURE_FORECAST"].includes(e.type) ? 90 : 1100);

export function MissionControl() {
  const [mode, setMode] = useState<"replay" | "live">("replay");
  const [scenario, setScenario] = useState<(typeof scenarios)[number]["id"]>("cooling");
  const [story, setStory] = useState<StoryData | null>(null);
  const [storyError, setStoryError] = useState("");
  const [live, setLive] = useState<Snapshot | null>(null);
  const [liveError, setLiveError] = useState("");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tech, setTech] = useState(false);
  const [selected, setSelected] = useState<Ev | null>(null);
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState("");

  // ---------- data loading ----------
  useEffect(() => {
    if (mode !== "replay") return;
    const c = new AbortController();
    setStory(null);
    setStoryError("");
    setPlaying(false);
    fetch(`/api/story?scenario=${scenario}`, { cache: "no-store", signal: c.signal })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setStory(j);
        setCursor(j.events.length - 1);
      })
      .catch((e) => !c.signal.aborted && setStoryError(e instanceof Error ? e.message : "Replay unavailable"));
    return () => c.abort();
  }, [mode, scenario]);

  const [liveRev, setLiveRev] = useState(0);
  useEffect(() => {
    if (mode !== "live") return;
    const c = new AbortController();
    let t: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        if (document.visibilityState !== "hidden") {
          const r = await fetch("/api/live", { cache: "no-store", signal: c.signal });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error);
          if (!c.signal.aborted) {
            setLive(j);
            setLiveError("");
          }
        }
      } catch (e) {
        if (!c.signal.aborted) setLiveError(e instanceof Error ? e.message : "Coordinator unreachable");
      } finally {
        if (!c.signal.aborted) t = setTimeout(poll, 2500);
      }
    };
    void poll();
    return () => {
      c.abort();
      clearTimeout(t);
    };
  }, [mode, liveRev]);

  // Open straight into live mode when the hosted coordinator is reachable.
  useEffect(() => {
    fetch("/api/live", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && Object.values(j.ready ?? {}).some(Boolean) && setMode("live"))
      .catch(() => {});
  }, []);

  const events: Ev[] = useMemo(() => {
    if (mode === "replay") return story ? fromStory(story) : [];
    return live?.replay ? fromLive(live.replay) : [];
  }, [mode, story, live]);

  useEffect(() => {
    if (mode === "live") setCursor(Math.max(0, events.length - 1));
  }, [mode, events.length]);

  // ---------- playback ----------
  const last = Math.max(0, events.length - 1);
  const cur = Math.min(cursor, last);
  useEffect(() => {
    if (!playing) return;
    if (cur >= last) {
      setPlaying(false);
      return;
    }
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setCursor(cur + 1), reduce ? 60 : pause(events[cur + 1]));
    return () => clearTimeout(t);
  }, [playing, cur, last, events]);

  const play = useCallback(() => {
    setCursor(0);
    setPlaying(true);
  }, []);

  const base = useMemo(() => derive(events, cur, mode === "replay" ? scenario : "live"), [events, cur, mode, scenario]);
  const lr = mode === "live" && base.resumed ? live?.replay?.recovery : null;
  const d = useMemo(() => ({ ...base, rto: base.rto ?? lr?.rto_ms ?? null, rpo: base.rpo ?? lr?.rpo_steps ?? null }), [base, lr]);
  const simulated = mode === "replay";
  const seen = events.slice(0, cur + 1);

  // ---------- derived chart data ----------
  const resumeStep = d.guards.verified?.step ?? null;
  const ghostIdx = events.findIndex((e) => e.type === "REHEARSAL_TOOL_RESULT" && Array.isArray((e.data.result as Record<string, unknown> | undefined)?.baseline));
  const showGhost = ghostIdx >= 0 && cur >= ghostIdx && story;
  const lossPrimary: { x: number; y: number }[] = [];
  const lossStandby: { x: number; y: number }[] = [];
  const ghost: { x: number; y: number }[] = [];
  if (mode === "replay" && story) {
    const maxStep = d.completed ? 100 : (d.step ?? 0);
    story.proof.recovered.slice(0, maxStep).forEach((y, i) => {
      const step = i + 1;
      (resumeStep && step >= resumeStep && d.resumed ? lossStandby : lossPrimary).push({ x: step, y });
    });
    if (showGhost) story.proof.baseline.forEach((y, i) => ghost.push({ x: i + 1, y }));
    if (lossStandby.length && lossPrimary.length) lossStandby.unshift(lossPrimary[lossPrimary.length - 1]);
  } else if (mode === "live" && live?.replay) {
    const first = live.replay.losses[0]?.worker;
    for (const l of live.replay.losses) (l.worker === first ? lossPrimary : lossStandby).push({ x: l.step, y: l.loss });
    if (lossStandby.length && lossPrimary.length) lossStandby.unshift(lossPrimary[lossPrimary.length - 1]);
  }

  const tempSeries = d.temps.map((t) => ({ x: t.x, y: t.y }));
  const projection =
    d.forecast && tempSeries.length && d.forecast.secondsToLimit != null
      ? [tempSeries[tempSeries.length - 1], { x: tempSeries[tempSeries.length - 1].x + d.forecast.secondsToLimit, y: d.forecast.threshold }]
      : [];
  const tempMeasured = d.temps.some((t) => t.source === "measured");

  const toolEvents = seen.filter((e) => e.type === "REHEARSAL_TOOL_RESULT");
  const messages = seen.filter((e) => e.type === "REHEARSAL_MESSAGE" || e.type.startsWith("PHOTON_"));
  const report = mode === "live" ? live?.replay?.investigation : null;
  const brief = useMemo(() => buildBrief(d, events.slice(0, cur + 1), mode === "replay" ? scenario : "live", story?.proof.sha256), [d, events, cur, mode, scenario, story]);

  // ---------- live control ----------
  const connected = (Object.keys(roleNames) as Role[]).every((r) => live?.ready[r]);
  const health = live?.health;
  const gatewayDev = live?.run?.devices.gateway;
  const armed = gatewayDev?.stage === "armed" && Date.now() - gatewayDev.at * 1000 < 115_000;
  const busy = !!live?.run && live.run.phase !== "failed" && Date.now() - live.run.at * 1000 < (live.run.phase === "starting" ? 30_000 : 315_000) && !["COMPLETED", "FAILED"].includes(health?.state ?? "");
  async function startTraining() {
    setStarting(true);
    setStartError("");
    try {
      const r = await fetch("/api/live", { method: "POST" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error);
      setLiveRev((v) => v + 1);
    } catch (e) {
      setStartError(e instanceof Error ? e.message : "Could not start");
    } finally {
      setStarting(false);
    }
  }

  const loading = mode === "replay" ? !story && !storyError : !live && !liveError;
  const hasData = events.length > 0;
  const srcLabel = mode === "replay" ? "Replay of a real run · simulated faults" : "Live hardware · hosted coordinator";

  return (
    <main className="mc">
      <header className="mc-top">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◐
          </span>
          <div>
            <h1>LIFERAFT</h1>
            <p>Keeps expensive AI jobs alive when hardware fails</p>
          </div>
        </div>
        <div className="top-controls">
          <div className="seg" role="group" aria-label="Data source">
            <button aria-pressed={mode === "replay"} onClick={() => setMode("replay")}>
              Replay
            </button>
            <button aria-pressed={mode === "live"} onClick={() => setMode("live")}>
              Live hardware
            </button>
          </div>
          <label className="switch">
            <input type="checkbox" checked={tech} onChange={(e) => setTech(e.target.checked)} />
            <span>Show technical details</span>
          </label>
        </div>
      </header>

      <div className={`banner ${simulated ? "sim" : "livebar"}`} role="note">
        <b>{srcLabel}.</b>{" "}
        {simulated
          ? "Training steps and checkpoints are real; the overheating is injected and both “machines” run on one computer. Nothing here is pretending to be a real outage."
          : "Records below come from the hosted coordinator. The button press is an injected drill, never a real overheat."}
      </div>

      {mode === "live" && (
        <section className="card live-ctl" aria-label="Live controls">
          <div className="chips">
            {(Object.keys(roleNames) as Role[]).map((r) => (
              <span key={r} className={`chip ${live?.ready[r] ? "ok" : "off"}`}>
                <i /> {roleNames[r]} {live?.ready[r] ? "ready" : "offline"}
              </span>
            ))}
          </div>
          <button className="primary" disabled={starting || !connected || busy || !live?.controlsEnabled || !!liveError} onClick={startTraining}>
            {starting ? "Starting…" : "Start training on the Pi"}
          </button>
          <p role="status">
            {armed && health?.ready_for_drill
              ? "👉 Press the physical ESP32 button now."
              : busy
                ? "Run active. Waiting for a verified checkpoint, then the button arms."
                : live && !live.controlsEnabled
                  ? "Launch is disabled (start the dashboard with LIFERAFT_LIVE_OPERATOR=1)."
                  : connected
                    ? "All three device agents are ready."
                    : "Waiting for the Pi, Windows standby and ESP32 bridge agents."}
          </p>
          {(liveError || startError) && <p className="err">{friendlyError(startError || liveError)} Switch to Replay to see the story offline.</p>}
        </section>
      )}

      {loading && <div className="card empty">Loading verified evidence…</div>}
      {!loading && !hasData && (
        <div className="card empty">
          <h2>{mode === "replay" ? "No saved run found" : "No live job yet"}</h2>
          <p>{mode === "replay" ? (storyError || "Run `npm run demo` once to record real training drills, then reload.") : "Start training once all three agents are ready, or switch to Replay."}</p>
        </div>
      )}

      {hasData && (
        <>
          {/* ---------------- HERO ---------------- */}
          <section className={`hero tone-${d.phase.tone}`} aria-live="polite">
            <div className="hero-text">
              <span className="eyebrow">What is happening</span>
              <h2>{d.phase.headline}</h2>
              <p>{d.phase.sub}</p>
              <div className="hero-actions">
                {mode === "replay" && (
                  <button className="primary" onClick={playing ? () => setPlaying(false) : play}>
                    {playing ? "❚❚ Pause" : "▶ Play the story"}
                  </button>
                )}
                <span className="meta">
                  {d.step != null ? `Training step ${d.step}` : "No step yet"} · lease epoch {d.epoch}
                </span>
              </div>
            </div>
            <dl className="kpis">
              <Kpi label="Work lost" value={d.completed || d.resumed ? (d.rpo == null ? "unknown" : `${d.rpo} steps`) : "–"} hint="Completed training steps that had to be redone (RPO)" good={d.rpo === 0} />
              <Kpi label="Time to recover" value={d.resumed ? (d.rto == null ? "unknown" : `${(d.rto / 1000).toFixed(1)} s`) : "–"} hint="From the evacuation order to the next real step (RTO)" good={d.rto != null} />
              <Kpi label="Early warning" value={d.forecast?.secondsToLimit != null ? `${d.forecast.secondsToLimit.toFixed(0)} s` : d.warned ? "alarm" : "–"} hint="How long before the limit we knew" good={d.forecast?.secondsToLimit != null} />
              <Kpi
                label="Proof"
                value={showGhost && story ? (story.proof.weights_equal ? "identical" : "differs") : d.resumed ? "stepped" : "–"}
                hint={showGhost && story ? `Recovered run matches an uninterrupted run: max divergence ${story.proof.max_divergence}` : "A real optimizer step ran on the new machine"}
                good={d.resumed}
              />
            </dl>
          </section>

          {/* ---------------- SCENARIOS + SCRUBBER ---------------- */}
          {mode === "replay" && (
            <section className="scenarios" aria-label="Choose a failure to replay">
              {scenarios.map((s) => (
                <button key={s.id} aria-pressed={scenario === s.id} onClick={() => setScenario(s.id)}>
                  <b>{s.title}</b>
                  <span>{s.blurb}</span>
                </button>
              ))}
            </section>
          )}

          <section className="card map-card" aria-label="Fleet map">
            <FleetMap d={d} agentActive={toolEvents.length > 0 || !!report} notified={messages.length > 0} buttonDrill={seen.some((e) => e.type === "SENSOR_BUTTON") || mode === "live"} simulated={simulated} />
            {events.length > 1 && (
              <div className="scrub">
                <input
                  type="range"
                  min={0}
                  max={last}
                  value={cur}
                  disabled={mode === "live"}
                  aria-label="Scrub through the recorded timeline"
                  onChange={(e) => {
                    setPlaying(false);
                    setCursor(Number(e.target.value));
                  }}
                />
                <span>
                  Event {cur + 1} of {events.length} · {utcTime(events[cur]?.at ?? null)}
                </span>
              </div>
            )}
          </section>

          <div className="cols">
            {/* ---------------- STORY ---------------- */}
            <section className="card" aria-label="The story">
              <h3>The story, step by step</h3>
              <ol className="story">
                {d.chapters.map((c, i) => (
                  <li key={c.id} className={`ch ${c.done ? "done" : "todo"} ${c.tone}`}>
                    <span className="dot">{c.done ? "✓" : i + 1}</span>
                    <div>
                      <b>{c.title}</b>
                      {c.at && <time>{utcTime(c.at)}</time>}
                      <p>{c.plain}</p>
                      {tech && <code>{c.tech}</code>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>

            {/* ---------------- CHARTS ---------------- */}
            <div className="stack">
              <section className="card" aria-label="Temperature and forecast">
                <h3>
                  Heat and early warning <small>{tempMeasured ? "measured" : "injected for the drill"}</small>
                </h3>
                <LineChart
                  series={[
                    { label: "temp", color: "var(--warn)", points: tempSeries },
                    { label: "forecast", color: "var(--bad)", points: projection, dashed: true },
                  ]}
                  hlines={d.forecast ? [{ y: d.forecast.threshold, label: `limit ${d.forecast.threshold} °C`, color: "var(--bad)" }] : []}
                  yLabel="CPU temperature (°C)"
                  xLabel="seconds"
                  height={170}
                  empty="No temperature samples in this scenario"
                />
                <p className="cap">
                  {d.forecast?.secondsToLimit != null
                    ? `Straight-line fit says the limit is reached in about ${d.forecast.secondsToLimit.toFixed(0)} s (fit R² ${d.forecast.fit?.toFixed(2) ?? "?"}). We act before that, not after.`
                    : "The forecast needs six fresh readings before it will speak. One hot reading is not a trend."}
                </p>
              </section>
              <section className="card" aria-label="Training continuity">
                <h3>
                  Learning never reset <small>real loss values</small>
                </h3>
                <LineChart
                  series={[
                    ...(ghost.length ? [{ label: "ghost", color: "var(--muted)", points: ghost, dashed: true, width: 4, faint: true }] : []),
                    { label: "primary", color: "var(--info)", points: lossPrimary },
                    { label: "standby", color: "var(--ok)", points: lossStandby },
                  ]}
                  vlines={resumeStep && d.resumed ? [{ x: resumeStep, label: "handoff", color: "var(--bad)" }] : []}
                  yLabel="training loss"
                  xLabel="training step"
                  height={170}
                  empty="Waiting for training steps"
                />
                <Legend
                  items={[
                    { label: d.primary ?? "primary", color: "var(--info)" },
                    { label: d.standby ?? "standby", color: "var(--ok)" },
                    ...(ghost.length ? [{ label: "uninterrupted ghost run", color: "var(--muted)", dashed: true }] : []),
                  ]}
                />
                <p className="cap">
                  {showGhost && story
                    ? `The recovered line sits exactly on the ghost run that never failed (max difference ${story.proof.max_divergence}). Final weights fingerprint ${story.proof.sha256}.`
                    : "One continuous learning curve, even though two different machines produced it."}
                </p>
              </section>
            </div>
          </div>

          {/* ---------------- WHY NOT A DATABASE ---------------- */}
          <section className="card" aria-label="Why a database alone is not enough">
            <h3>Why isn’t “save progress to a database” enough?</h3>
            <p className="lead">Saving a file is the easy 10%. The hard parts are knowing <b>when</b> to move, <b>who</b> is allowed to write, and <b>whether the copy is good</b>. LIFERAFT does those too.</p>
            <div className="guards">
              <Guard title="When to move" q="A database only reacts after a crash." a="We predict the failure from the heat trend and evacuate early." lit={d.warned} proof={d.forecast?.secondsToLimit != null ? `Warned ${d.forecast.secondsToLimit.toFixed(0)} s ahead` : d.warned ? "Alarm raised" : undefined} />
              <Guard title="Who may write" q="Two machines can both think they own the job and corrupt it." a="Leases with fencing epochs: the old owner is refused the moment a new one is crowned." lit={d.handedOff} proof={d.guards.staleLease ? "Zombie write blocked" : d.handedOff ? `Epoch ${d.epoch} crowned` : undefined} />
              <Guard title="Is the copy good" q="A corrupted checkpoint silently ruins a week of training." a="Every checkpoint carries a SHA-256 fingerprint verified before use, with fallback." lit={!!d.guards.rejectedCheckpoint || d.resumed} proof={d.guards.rejectedCheckpoint ? "Bad copy rejected" : d.resumed ? "Hash verified" : undefined} />
              <Guard title="Did it really work" q="“Restore succeeded” only means a file was read." a="We require a real optimizer step on the new machine before saying recovered." lit={d.resumed} proof={d.resumed ? `Step ${d.guards.verified?.step ?? "?"} ran` : undefined} />
            </div>
          </section>

          <div className="cols">
            {/* ---------------- AGENT ---------------- */}
            <section className="card" aria-label="AI operations agent">
              <h3>
                AI ops agent <small>{mode === "live" ? "NVIDIA Nemotron" : "deterministic planner (no API key in replay)"}</small>
              </h3>
              <p className="cap">It investigates, plans and explains using <b>read-only</b> tools. It cannot move work, release a lease or touch hardware. Code makes the final call.</p>
              <ol className="agent">
                {toolEvents.map((e) => {
                  const r = e.data.result as Record<string, unknown> | undefined;
                  return (
                    <li key={e.id} onClick={() => setSelected(e)}>
                      <code>{String(e.data.tool)}</code>
                      <span>{toolSummary(String(e.data.tool), r)}</span>
                    </li>
                  );
                })}
                {report?.tools.map((t, i) => (
                  <li key={i}>
                    <code>{t.name}</code>
                    <span>{t.event_ids.length} journal events consulted</span>
                  </li>
                ))}
                {report?.facts.map((f, i) => (
                  <li key={`f${i}`} className="fact">
                    <code>finding</code>
                    <span>{f.text}</span>
                  </li>
                ))}
                {!toolEvents.length && !report && <li className="muted">The agent wakes up when an incident appears.</li>}
              </ol>
              {report && <p className="cap">Outcome at analysis time: {report.outcome}. {report.uncertainty}</p>}
              {live?.providers.nemotron && <p className="cap">Status: {live.providers.nemotron}</p>}
            </section>

            {/* ---------------- ON-CALL ---------------- */}
            <section className="card" aria-label="On-call messages">
              <h3>
                On-call channel <small>{mode === "live" ? "Photon" : "simulated, no real message sent"}</small>
              </h3>
              <div className="chat">
                {messages.map((m) => (
                  <div className="bubble" key={m.id}>
                    <p>{String(m.data.text ?? m.type.replaceAll("_", " ").toLowerCase())}</p>
                    <time>{utcTime(m.at)} · {m.source}</time>
                  </div>
                ))}
                {d.resumed && (
                  <div className="bubble ok">
                    <p>✅ Recovered. {d.owner} is training from step {d.guards.verified?.step ?? "?"}. No completed steps lost.</p>
                    <time>generated from verified facts</time>
                  </div>
                )}
                {!messages.length && !d.resumed && <p className="muted">No messages yet.</p>}
              </div>
              {live?.providers.photon && <p className="cap">Status: {live.providers.photon}</p>}
              <div className="reply">
                <button disabled>Approve</button>
                <button disabled>Hold</button>
                <button disabled>Roll back</button>
                <small>Reply buttons are previews. A human reply never bypasses safety checks.</small>
              </div>
            </section>
          </div>

          {/* ---------------- HANDOFF BRIEF + COST ---------------- */}
          <div className="cols">
            <section className="card" aria-label="Shift handoff brief">
              <h3>Shift handoff brief</h3>
              <p className="cap">For the next engineer on shift. Built only from verified events.</p>
              <pre className="brief">{brief}</pre>
              <button onClick={() => navigator.clipboard?.writeText(brief)}>Copy brief</button>
            </section>
            <Impact rto={d.rto} rpo={d.rpo} />
          </div>

          {/* ---------------- TECH ---------------- */}
          {tech && (
            <section className="card" aria-label="Flight recorder">
              <h3>Flight recorder · hash-chained events</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Time (UTC)</th>
                      <th>Event</th>
                      <th>Source</th>
                      <th>Worker</th>
                      <th>Epoch</th>
                      <th>Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {seen
                      .filter((e) => !["WORKER_HEARTBEAT"].includes(e.type))
                      .map((e) => (
                        <tr key={e.id} onClick={() => setSelected(e)} className={selected?.id === e.id ? "sel" : ""}>
                          <td>{e.seq}</td>
                          <td>{utcTime(e.at)}</td>
                          <td>{e.type}</td>
                          <td><span className={`src ${e.source}`}>{e.source}</span></td>
                          <td>{e.worker ?? "–"}</td>
                          <td>{e.epoch}</td>
                          <td><code>{e.hash.slice(0, 12)}</code></td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {selected && <pre className="json">{JSON.stringify(selected.data, null, 2).slice(0, 2400)}</pre>}
              <p className="cap">
                Chain valid: {mode === "replay" ? String(story?.chain_valid) : String(live?.replay?.journal.anchored ?? "unknown")}. Sources: <b>measured</b> from sensors, <b>injected</b> faults, <b>derived</b> by the coordinator, <b>simulated</b> messaging.
              </p>
            </section>
          )}
        </>
      )}

      <footer className="mc-foot">
        <p>
          Honest labels: training steps, losses, checkpoints, hashes and lease epochs are real. Faults are injected on purpose. The replay runs both machines on one computer; the live mode uses a Raspberry Pi, a Windows laptop and an ESP32 over a hosted coordinator.
        </p>
        <a href="/evidence">Open the classic evidence console →</a>
      </footer>
    </main>
  );
}

function friendlyError(message: string) {
  return /CLOUD_TOKEN|operator/i.test(message)
    ? "The operator token is missing. Paste it into .env.operator (LIFERAFT_CLOUD_TOKEN=…) from Render → liferaft-coordinator → Environment → LIFERAFT_OPERATOR_TOKEN, then refresh."
    : message;
}

function Kpi({ label, value, hint, good }: { label: string; value: string; hint: string; good?: boolean }) {
  return (
    <div className={`kpi ${good ? "good" : ""}`} title={hint}>
      <dt>{label}</dt>
      <dd>{value}</dd>
      <small>{hint}</small>
    </div>
  );
}

function Guard({ title, q, a, lit, proof }: { title: string; q: string; a: string; lit: boolean; proof?: string }) {
  return (
    <article className={`guard ${lit ? "lit" : ""}`}>
      <h4>{title}</h4>
      <p className="q">{q}</p>
      <p className="a">{a}</p>
      <span className="proof">{lit && proof ? `✓ ${proof}` : "not triggered yet"}</span>
    </article>
  );
}

function Impact({ rto, rpo }: { rto: number | null; rpo: number | null }) {
  const [gpus, setGpus] = useState(64);
  const [rate, setRate] = useState(2.5);
  const [hours, setHours] = useState(6);
  const without = gpus * rate * hours;
  const withLr = rto == null ? null : (gpus * rate * rto) / 3_600_000;
  const money = (n: number) => n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: n < 10 ? 2 : 0 });
  return (
    <section className="card" aria-label="Business impact">
      <h3>
        What a failure costs <small>your assumptions + measured recovery</small>
      </h3>
      <div className="sliders">
        <label>
          GPUs in the job: <b>{gpus}</b>
          <input type="range" min={8} max={1024} step={8} value={gpus} onChange={(e) => setGpus(+e.target.value)} />
        </label>
        <label>
          Cost per GPU-hour: <b>${rate.toFixed(2)}</b>
          <input type="range" min={1} max={8} step={0.25} value={rate} onChange={(e) => setRate(+e.target.value)} />
        </label>
        <label>
          Hours since last manual save: <b>{hours} h</b>
          <input type="range" min={1} max={24} value={hours} onChange={(e) => setHours(+e.target.value)} />
        </label>
      </div>
      <div className="money">
        <div className="bad">
          <small>Without LIFERAFT</small>
          <b>{money(without)}</b>
          <span>of compute redone</span>
        </div>
        <div className="good">
          <small>With LIFERAFT</small>
          <b>{withLr == null ? "–" : money(withLr)}</b>
          <span>{rpo === 0 ? "0 steps lost" : rpo == null ? "run a drill to measure" : `${rpo} steps lost`}</span>
        </div>
      </div>
      <p className="cap">Illustrative model: dollars come from the sliders, not from a bill. Recovery time and lost steps are measured in this run on a small CPU job; real RTO scales with checkpoint size.</p>
    </section>
  );
}

function buildBrief(d: ReturnType<typeof derive>, seen: Ev[], scenario: string, hash?: string): string {
  if (!seen.length) return "No incident recorded.";
  const trig = d.chapters.find((c) => c.id === "warn");
  const lines = [
    `INCIDENT HANDOFF · ${scenario === "live" ? "live hardware" : "drill: " + scenario}`,
    `Status: ${d.completed ? "RESOLVED, job complete" : d.resumed ? "RECOVERED, job running" : d.handedOff ? "IN PROGRESS, handing over" : "MONITORING"}`,
    "",
    "What happened",
    `- ${trig?.done ? trig.plain : "No incident detected yet."}`,
    d.handedOff ? `- Job moved from ${d.primary} to ${d.owner} (lease epoch ${d.epoch}); old owner is fenced.` : "",
    d.resumed ? `- First real step on new owner: step ${d.guards.verified?.step ?? "?"}. Completed steps lost: ${d.rpo ?? "unknown"}. Time to recover: ${d.rto == null ? "unknown" : (d.rto / 1000).toFixed(1) + " s"}.` : "",
    hash ? `- Final weights fingerprint: ${hash}.` : "",
    "",
    "Next actions for the engineer",
    d.handedOff ? `1. Keep ${d.primary} out of rotation until cooling / hardware is checked.` : "1. Watch the primary; no action needed yet.",
    "2. Confirm checkpoint fingerprint matches the coordinator ledger.",
    "3. Return the machine only after a clean thermal reading.",
    "",
    "Caveat: injected faults in drills are not real overheating.",
  ];
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n");
}
