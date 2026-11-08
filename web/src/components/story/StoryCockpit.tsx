"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { caption, scenarios, type StoryData, type StoryEvent } from "./types";
import "./story.css";
import { WorkerLogs } from "../workers/WorkerLogs";

const WorkerScene = dynamic(() => import("./WorkerScene"), {
  ssr: false,
  loading: () => (
    <div className="story-scene story-scene-fallback">
      Loading worker constellation…
    </div>
  ),
});

function last(events: StoryEvent[], kind: string) {
  return events.filter((event) => event.event_type === kind).at(-1);
}
function number(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}
function traceResult(event: StoryEvent) {
  return event.evidence.result as Record<string, unknown>;
}

export function StoryCockpit() {
  const [scenario, setScenario] = useState("cooling");
  const [data, setData] = useState<StoryData | null>(null);
  const [error, setError] = useState("");
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [reload, setReload] = useState(0);
  const [price, setPrice] = useState(3);
  const [gpus, setGpus] = useState(8);
  const [hours, setHours] = useState(12);
  const [resumeMinutes, setResumeMinutes] = useState(2);
  const [reply, setReply] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError("");
    setPlaying(false);
    setCursor(0);
    setReply("");
    fetch(`/api/story?scenario=${scenario}`, {
      signal: controller.signal,
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.error ?? "Evidence unavailable.");
        setData(payload);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message);
      });
    return () => controller.abort();
  }, [scenario, reload]);
  useEffect(() => {
    if (!playing || !data) return;
    const interval = setInterval(
      () =>
        setCursor((current) => Math.min(current + 1, data.events.length - 1)),
      90_000 / Math.max(data.events.length - 1, 1),
    );
    return () => clearInterval(interval);
  }, [playing, data]);
  useEffect(() => {
    if (data && cursor === data.events.length - 1) setPlaying(false);
  }, [cursor, data]);

  const visible = data?.events.slice(0, cursor + 1) ?? [];
  const selected = visible.at(-1);
  const telemetry = last(visible, "REHEARSAL_TELEMETRY");
  const forecast = last(visible, "FAILURE_FORECAST");
  const eta = number(forecast?.evidence.seconds_to_limit);
  const fit = number(forecast?.evidence.fit_quality);
  const temperature = number(telemetry?.evidence.cpu_c);
  const transferred = Boolean(last(visible, "LEASE_TRANSFERRED"));
  const resumed = Boolean(last(visible, "FIRST_RESUMED_STEP_COMPLETED"));
  const proof = visible.find(
    (e) =>
      e.event_type === "REHEARSAL_TOOL_RESULT" &&
      e.evidence.tool === "verify_continuity",
  );
  const tools = visible.filter((e) => e.event_type === "REHEARSAL_TOOL_RESULT");
  const messages = visible.filter((e) => e.event_type === "REHEARSAL_MESSAGE");
  const step = Math.max(
    0,
    ...visible.map(
      (e) => number(e.evidence.step) ?? number(e.evidence.checkpoint_step) ?? 0,
    ),
  );
  const epoch = selected?.lease_epoch ?? 0;
  const warning = Boolean(telemetry) && !resumed;
  const baseline = data?.proof.baseline ?? [];
  const recovered = (data?.proof.recovered ?? []).slice(0, step);
  const maxLoss = Math.max(...baseline, 0.01);
  const path = (values: number[]) =>
    values
      .map(
        (value, index) =>
          `${index ? "L" : "M"}${42 + (index / Math.max(baseline.length - 1, 1)) * 706},${175 - (value / maxLoss) * 145}`,
      )
      .join(" ");
  const costRestart = price * gpus * hours;
  const costResume = (price * gpus * resumeMinutes) / 60;
  const costAvoided = Math.max(0, costRestart - costResume);
  const selectedScenario = scenarios.find((item) => item.id === scenario)!;
  useEffect(() => {
    if (!playing || !selected) return;
    let target: string | undefined;
    if (
      selected.event_type === "FAILURE_FORECAST" &&
      selected.evidence.eligible
    )
      target = ".story-forecast";
    if (
      selected.event_type === "REHEARSAL_TOOL_RESULT" &&
      selected.evidence.tool === "read_telemetry"
    )
      target = ".story-hero";
    if (selected.event_type === "LEASE_TRANSFERRED") target = ".story-hero";
    if (
      selected.event_type === "REHEARSAL_TOOL_RESULT" &&
      selected.evidence.tool === "verify_continuity"
    )
      target = ".story-ghost";
    if (selected.event_type === "REHEARSAL_MESSAGE") target = ".story-ghost";
    if (target)
      document.querySelector(target)?.scrollIntoView({
        block: "center",
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }, [playing, selected]);

  return (
    <main
      className={`story ${resumed ? "is-safe" : warning ? "is-warning" : ""}`}
    >
      <header className="story-nav">
        <a className="story-brand" href="/story">
          <span className="story-brand-mark">↗</span> LIFERAFT
        </a>
        <div className="story-nav-right">
          <span className="story-tag">
            <i /> SAVED REPLAY
          </span>
          <a href="/">Evidence cockpit ↗</a>
        </div>
      </header>
      <div className="story-disclosure">
        <span>LOCAL REHEARSAL</span> Real PyTorch · two processes on one host ·
        injected faults · simulated messaging · deterministic planner
      </div>
      <section className="story-heading">
        <div>
          <p className="story-eyebrow">COMPUTE RECOVERY, WITH PROOF</p>
          <h1>
            Keep training.
            <br />
            <em>Even when the machine can’t.</em>
          </h1>
        </div>
        <div className="story-heading-actions">
          <p>See the warning. Move the job. Prove nothing changed.</p>
          <button
            className="story-run"
            disabled={!data}
            onClick={() => {
              if (!playing && cursor === (data?.events.length ?? 0) - 1)
                setCursor(0);
              setPlaying(!playing);
            }}
          >
            {playing ? "Ⅱ Pause story" : "▶ Run the story"}
            <span>90 SEC REPLAY</span>
          </button>
        </div>
      </section>
      {error ? (
        <div className="story-error" role="alert">
          {error}
          <button onClick={() => setReload(reload + 1)}>
            Retry verification
          </button>
        </div>
      ) : null}
      {!data && !error ? (
        <p role="status">Verifying saved journal and checkpoint bytes…</p>
      ) : null}
      <div className="story-main-grid">
        <section
          className="story-panel story-hero"
          aria-label="Worker constellation"
        >
          <div className="story-panel-heading">
            <div>
              <p className="story-eyebrow">THE HANDOFF</p>
              <h2>Move the job. Keep the progress.</h2>
            </div>
            <span className={`story-tag ${resumed ? "safe" : ""}`}>
              <i />
              {resumed
                ? "RESUME OBSERVED"
                : warning
                  ? "RISK INJECTED"
                  : "REPLAY READY"}
            </span>
          </div>
          <WorkerScene
            transferred={transferred}
            warning={warning}
            playing={playing}
          />
          <div className="story-node-labels">
            <div>
              <b>LOCAL PRIMARY</b>
              <span>
                {transferred ? "Fenced · epoch 1" : "CPU training process"}
              </span>
            </div>
            <div>
              <b>COORDINATOR</b>
              <span>SQLite · local adapter</span>
            </div>
            <div>
              <b>LOCAL STANDBY</b>
              <span>
                {resumed
                  ? "Training continued · epoch 2"
                  : "Separate worker process"}
              </span>
            </div>
          </div>
          <div className="story-hero-footer">
            <span>
              <i className="story-dot" /> CHECKPOINT-AWARE TRAINING
            </span>
            <span>
              OWNER EPOCH <b>{epoch}</b>
            </span>
          </div>
        </section>
        <section className="story-panel story-forecast">
          <div className="story-panel-heading">
            <div>
              <p className="story-eyebrow">THE EARLY WARNING</p>
              <h2>Before it fails.</h2>
            </div>
            <span className="story-source">INJECTED</span>
          </div>
          <div className="story-ring">
            <svg viewBox="0 0 200 200" aria-hidden="true">
              <circle className="story-ring-bg" cx="100" cy="100" r="83" />
              <circle
                className="story-ring-value"
                cx="100"
                cy="100"
                r="83"
                strokeDasharray={`${eta === null ? 0 : Math.min(eta / 90, 1) * 521} 521`}
              />
            </svg>
            <div>
              <strong>
                {resumed ? "SAFE" : eta === null ? "—" : `${Math.round(eta)}s`}
              </strong>
              <span>
                {resumed ? "handoff observed" : "estimated to thermal limit"}
              </span>
            </div>
          </div>
          <details className="story-reading-details">
            <summary>How the estimate works</summary>
            <div className="story-forecast-stats">
              <div>
                <span>CPU trend</span>
                <b>
                  {temperature === null
                    ? "Unknown"
                    : `${temperature.toFixed(1)}°C`}
                </b>
              </div>
              <div>
                <span>Trend fit · R²</span>
                <b>{fit === null ? "Unknown" : `${(fit * 100).toFixed(0)}%`}</b>
              </div>
              <div>
                <span>Physical Pi / ambient</span>
                <b>Not connected</b>
              </div>
            </div>
            <p className="story-note">
              Linear trend toward 80°C. Fit quality is not a failure
              probability. Readings are injected; no hardware is heated.
            </p>
          </details>
          <p className="story-note">
            Injected cooling trend · no hardware is heated.
          </p>
        </section>
        <section className="story-panel story-ghost">
          <div className="story-panel-heading">
            <div>
              <p className="story-eyebrow">WHAT SETS US APART</p>
              <h2>Proof, down to the last update.</h2>
              <p>
                The ghost run never stops. The recovered job should follow the
                same line.
              </p>
            </div>
            <span className="story-source">MEASURED LOSSES</span>
          </div>
          <div className="story-chart-legend">
            <span>
              <i /> Recovered job
            </span>
            <span>
              <i /> Uninterrupted ghost
            </span>
            <span>SEED 1729 · CPU</span>
          </div>
          <svg
            viewBox="0 0 780 210"
            className="story-loss"
            role="img"
            aria-label={`Real loss comparison. ${step} updates visible. ${proof ? "All baseline and recovered losses match exactly." : "Proof pending at replay cursor."}`}
          >
            {[30, 78, 126, 175].map((y, i) => (
              <g key={y}>
                <line
                  x1="42"
                  y1={y}
                  x2="748"
                  y2={y}
                  stroke="#26324a"
                  strokeDasharray="3 6"
                />
                <text x="0" y={y + 4} fill="#9aa8c2" fontSize="11">
                  {(maxLoss * (1 - i / 3)).toFixed(2)}
                </text>
              </g>
            ))}
            <path
              d={path(baseline)}
              fill="none"
              stroke="#9ba9cb"
              strokeWidth="4"
              strokeDasharray="5 5"
              opacity=".7"
            />
            <path
              d={path(recovered)}
              fill="none"
              stroke="#75edc8"
              strokeWidth="2"
            />
            {data && resumed ? (
              <g>
                <line
                  x1={42 + ((data.status.resume_step - 1) / 99) * 706}
                  y1="20"
                  x2={42 + ((data.status.resume_step - 1) / 99) * 706}
                  y2="175"
                  stroke="#f6b862"
                  strokeDasharray="4 4"
                />
                <text x="400" y="18" fill="#f6b862" fontSize="11">
                  VERIFIED RESUME → STEP {data.status.resume_step}
                </text>
              </g>
            ) : null}
            <text x="42" y="202" fill="#9aa8c2" fontSize="11">
              STEP 1
            </text>
            <text x="688" y="202" fill="#9aa8c2" fontSize="11">
              STEP 100
            </text>
          </svg>
          <div className={`story-proof ${proof ? "verified" : ""}`}>
            <div>
              <span>DIFFERENCE FROM GHOST</span>
              <strong>
                {proof
                  ? data?.proof.max_divergence.toFixed(6)
                  : "Awaiting comparison"}
              </strong>
            </div>
            <div>
              <span>TRAINING STEPS LOST</span>
              <strong>
                {resumed ? (data?.status.rpo_steps ?? "Unknown") : "—"}
              </strong>
            </div>
            <div>
              <span>FINAL MODEL</span>
              <strong>
                {proof
                  ? data?.proof.weights_equal
                    ? "Exact match ✓"
                    : "Mismatch"
                  : "Pending"}
              </strong>
            </div>
          </div>
          <p className="story-note">
            {proof
              ? `${data?.proof.compared_steps} losses compared · final SHA-256 prefix ${data?.proof.sha256} · same-host CPU proof`
              : "The baseline is real precomputed evidence. The recovered curve follows recorded steps; verification is revealed only at its journal event."}
          </p>
        </section>
      </div>
      <WorkerLogs />
      <details className="story-advanced">
        <summary>
          <span>Under the hood</span>
          <span>
            Agent tools, on-call brief & cost estimate <b>＋</b>
          </span>
        </summary>
        <div className="story-more-grid">
          <section className="story-panel story-agent">
            <div className="story-panel-heading">
              <div>
                <p className="story-eyebrow">04 / DECIDE</p>
                <h2>Evidence, then action.</h2>
              </div>
              <span className="story-source">FALLBACK PLANNER</span>
            </div>
            <p className="story-note">
              Real read-only tools. Deterministic coordinator owns fencing and
              migration. Nemotron is not called in this rehearsal.
            </p>
            <div className="story-tool-list">
              {tools.length ? (
                tools.map((event) => (
                  <details key={event.event_id}>
                    <summary>
                      <span className="story-tool-check">✓</span>
                      <code>{String(event.evidence.tool)}()</code>
                      <span>READ ONLY</span>
                    </summary>
                    <pre>
                      {JSON.stringify(
                        {
                          input: event.evidence.arguments,
                          output: traceResult(event),
                        },
                        null,
                        2,
                      )}
                    </pre>
                  </details>
                ))
              ) : (
                <div className="story-waiting">
                  01 <span>Waiting for evidence at this cursor…</span>
                </div>
              )}
            </div>
            {transferred ? (
              <div className="story-policy">
                <span>✓</span> POLICY ENGINE: LEASE TRANSFERRED · EPOCH 2
              </div>
            ) : null}
          </section>
          <section className="story-panel story-photon">
            <div className="story-panel-heading">
              <div>
                <p className="story-eyebrow">05 / BRIEF</p>
                <h2>Keep the human close.</h2>
              </div>
              <span className="story-source">MOCK PHOTON</span>
            </div>
            <div className="story-phone">
              <div className="story-phone-header">
                <span className="story-avatar">L</span>
                <div>
                  <b>LIFERAFT on-call</b>
                  <span>SIMULATED MESSAGING · NO SEND</span>
                </div>
              </div>
              <div className="story-chat">
                {messages.length ? (
                  messages.map((event) => (
                    <div className="story-bubble" key={event.event_id}>
                      {String(event.evidence.text)}
                      <small>
                        {new Date(event.created_utc)
                          .toISOString()
                          .slice(11, 19)}{" "}
                        UTC · simulated
                      </small>
                    </div>
                  ))
                ) : (
                  <p className="story-note">
                    The incident brief will appear at its recorded event.
                  </p>
                )}
                {reply ? (
                  <div className="story-bubble story-reply" role="status">
                    {reply}
                    <small>INTERACTION PREVIEW · NO STATE CHANGE</small>
                  </div>
                ) : null}
              </div>
              <div className="story-replies">
                {["APPROVE", "HOLD", "ROLLBACK"].map((command) => (
                  <button
                    key={command}
                    onClick={() =>
                      setReply(
                        command === "ROLLBACK"
                          ? "ROLLBACK refused: the old epoch cannot be restored safely."
                          : command === "HOLD"
                            ? "HOLD preview: a live approval policy would pause before requesting migration. This saved replay is unchanged."
                            : "APPROVE preview: only coordinator policy may authorize a new owner. This saved replay is unchanged.",
                      )
                    }
                  >
                    {command}
                  </button>
                ))}
              </div>
            </div>
            <p className="story-note">
              Rehearsal auto-execute: 0s. Reply buttons preview behavior. Live
              STATUS/ACK use the existing signed Photon integration.
            </p>
          </section>
          <section className="story-panel story-money">
            <div className="story-panel-heading">
              <div>
                <p className="story-eyebrow">THE COST OF STARTING OVER</p>
                <h2>Protect more than progress.</h2>
              </div>
              <span className="story-source">ILLUSTRATIVE</span>
            </div>
            <strong className="story-money-number">
              $
              {costAvoided.toLocaleString("en-US", {
                maximumFractionDigits: 2,
              })}
              <span>estimated cost avoided per interruption</span>
            </strong>
            <div className="story-cost-bars">
              <div>
                <span>Restart from zero</span>
                <b>${costRestart.toFixed(2)}</b>
              </div>
              <div>
                <span>Resume from checkpoint</span>
                <b>${costResume.toFixed(2)}</b>
              </div>
            </div>
            <div className="story-cost-inputs">
              {[
                { label: "$ / GPU-hour", value: price, set: setPrice },
                { label: "GPU count", value: gpus, set: setGpus },
                { label: "Restart hours", value: hours, set: setHours },
                {
                  label: "Resume minutes",
                  value: resumeMinutes,
                  set: setResumeMinutes,
                },
              ].map((input) => (
                <label key={input.label}>
                  {input.label}
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    step="any"
                    value={input.value}
                    onChange={(event) =>
                      input.set(
                        Math.max(
                          0,
                          Math.min(100000, Number(event.target.value) || 0),
                        ),
                      )
                    }
                  />
                </label>
              ))}
            </div>
            <details className="story-formula">
              <summary>Show the estimate formula</summary>
              <p>
                max(0, GPU-hour price × GPU count × (restart hours − resume
                minutes / 60)). Assumes equivalent GPU allocation. These
                editable GPU assumptions are unrelated to this small CPU demo;
                this is not a measured saving.
              </p>
            </details>
          </section>
        </div>
      </details>
      <section className="story-chaos" aria-label="Chaos menu">
        <div>
          <p className="story-eyebrow">TRY ANOTHER SCENARIO</p>
          <h2>
            Different failures.
            <br />
            <span>Same standard of proof.</span>
          </h2>
          <p>Load an observed local drill.</p>
        </div>
        <div className="story-scenarios">
          {scenarios.map((item) => (
            <button
              key={item.id}
              className={scenario === item.id ? "selected" : ""}
              aria-pressed={scenario === item.id}
              onClick={() => {
                setPlaying(false);
                setScenario(item.id);
              }}
            >
              <span>{item.icon}</span>
              <b>{item.title}</b>
              <small>{item.detail}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="story-panel story-recorder">
        <div className="story-panel-heading">
          <div>
            <p className="story-eyebrow">
              {selectedScenario.title.toUpperCase()} / SAVED REPLAY
            </p>
            <h2>Follow the story.</h2>
          </div>
          <button
            className="story-reverify"
            onClick={() => setReload(reload + 1)}
          >
            ↻ Re-verify evidence
          </button>
        </div>
        <div className="story-caption" aria-live="polite">
          <span>{String(cursor + 1).padStart(2, "0")}</span>
          <p>{caption(selected)}</p>
        </div>
        <label className="story-scrub-label">
          Replay position{" "}
          <span>
            {data ? `${cursor + 1} / ${data.events.length}` : "No evidence"}
          </span>
          <input
            aria-label="Replay position"
            type="range"
            min="0"
            max={Math.max((data?.events.length ?? 1) - 1, 0)}
            value={cursor}
            onChange={(event) => {
              setPlaying(false);
              setCursor(Number(event.target.value));
            }}
          />
        </label>
        <details className="story-reading-details story-technical-record">
          <summary>Inspect the flight recorder</summary>
          <div className="story-chain">
            {data?.events.map((event, index) => (
              <button
                key={event.event_id}
                aria-label={`Event ${index + 1}: ${event.event_type}`}
                title={`${event.event_type} · ${event.source_type}`}
                className={index <= cursor ? "lit" : ""}
                onClick={() => {
                  setPlaying(false);
                  setCursor(index);
                }}
              />
            ))}
          </div>
          {selected ? (
            <details className="story-event">
              <summary>
                <span>
                  {new Date(selected.created_utc).toISOString().slice(11, 23)}{" "}
                  UTC
                </span>
                <b>{selected.event_type}</b>
                <span>
                  {selected.source_type} · #{selected.seq} ·{" "}
                  {selected.event_hash}
                </span>
              </summary>
              <pre>{JSON.stringify(selected, null, 2)}</pre>
            </details>
          ) : null}
        </details>
        <div className="story-recorder-footer">
          <span>
            <i className="story-dot" />{" "}
            {data?.chain_valid
              ? "HASH CHAIN VERIFIED · FINAL CHECKPOINT REHASHED"
              : "VERIFICATION PENDING"}
          </span>
          <span>Read-only · no recovery controls · UTC</span>
        </div>
      </section>
      <footer className="story-footer">
        <span>
          LIFERAFT <span> / </span> PREDICT. DECIDE. EVACUATE. PROVE. BRIEF.
        </span>
        <a href="/">Inspect original evidence cockpit ↗</a>
      </footer>
      {playing ? (
        <aside
          className="story-presentation"
          aria-label="Presentation captions"
        >
          <span>REPLAY {String(cursor + 1).padStart(2, "0")}</span>
          <p>{caption(selected)}</p>
          <button onClick={() => setPlaying(false)}>Ⅱ Pause</button>
        </aside>
      ) : null}
    </main>
  );
}
