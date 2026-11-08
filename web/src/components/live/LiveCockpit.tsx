"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { Replay } from "../../lib/replay";
import { WorkerLogPanel, type Feed } from "../workers/WorkerLogs";
import "./live.css";

const roles = {
  pi_primary: "Raspberry Pi",
  standby: "Windows standby",
  gateway: "ESP32 bridge",
} as const;
const stages: Record<string, string> = {
  starting: "Assignment received",
  training: "Worker command running",
  waiting_checkpoint: "Waiting for a verified checkpoint",
  armed: "Button armed",
  triggered: "Button event forwarded",
  finished: "Command finished",
  failed: "Command failed",
};
type Role = keyof typeof roles;
type Snapshot = {
  ready: Partial<Record<Role, boolean>>;
  controlsEnabled: boolean;
  run: {
    job: string;
    phase: string;
    at: number;
    devices: Partial<
      Record<Role, { stage: string; at: number; reason?: string }>
    >;
  } | null;
  job: string | null;
  replay: Replay | null;
  devices: Feed["devices"];
  health: {
    state: string;
    owner: string | null;
    ready_for_drill: boolean;
    checkpoint: { step: number; sha256_prefix: string } | null;
    reasons: string[];
  } | null;
  providers: Record<string, string>;
};

export function LiveCockpit() {
  const [job, setJob] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState("");
  const [startError, setStartError] = useState("");
  const [starting, setStarting] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        if (document.visibilityState !== "hidden") {
          const response = await fetch(
            job ? `/api/live?job=${encodeURIComponent(job)}` : "/api/live",
            { cache: "no-store", signal: controller.signal },
          );
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          if (!controller.signal.aborted) {
            setData(result);
            setError("");
          }
        }
      } catch (failure) {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error
              ? failure.message
              : "Coordinator unavailable.",
          );
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 2500);
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [job, revision]);

  async function start() {
    if (starting) return;
    setStarting(true);
    setStartError("");
    try {
      const response = await fetch("/api/live", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setRevision((value) => value + 1);
    } catch (failure) {
      setStartError(
        failure instanceof Error
          ? failure.message
          : "Training could not be started.",
      );
    } finally {
      setStarting(false);
    }
  }

  function select(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const next = input.trim();
    if (next === job) return;
    setJob(next);
    setData(null);
    setError("");
    setStartError("");
  }

  const proof = data?.replay?.recovery;
  const health = data?.health;
  const connected = (Object.keys(roles) as Role[]).every(
    (role) => data?.ready[role],
  );
  const busy =
    data?.run &&
    data.run.phase !== "failed" &&
    Date.now() - data.run.at * 1000 <
      (data.run.phase === "starting" ? 30_000 : 315_000) &&
    !["COMPLETED", "FAILED"].includes(health?.state ?? "");
  const gateway = data?.run?.devices.gateway;
  const armed =
    gateway?.stage === "armed" && Date.now() - gateway.at * 1000 < 115_000;
  const trigger = data?.replay?.events.find(
    (event) => event.kind === "SENSOR_EVENT_RECEIVED" && event.sensor?.button,
  );
  const receipt = data?.replay?.events
    .filter((event) => event.kind.startsWith("PHOTON_"))
    .at(-1);
  const report = data?.replay?.investigation;
  const piTemp = data?.replay?.events
    .filter((event) => event.cpu_c != null)
    .at(-1);
  const feed: Feed | null =
    data?.job && data.replay
      ? {
          job: data.job,
          mode: job ? "saved" : "cloud",
          notice:
            "Verified coordinator records. Loss is displayed when an actual optimizer sample is recorded.",
          checked_at: data.replay.journal.at,
          devices: data.devices,
          other_workers: [],
        }
      : null;

  return (
    <main className="live-cockpit">
      <nav aria-label="Cockpit views">
        <a href="/">Evidence cockpit</a>
        <a href="/story">Saved rehearsal</a>
      </nav>
      <header>
        <p className="live-kicker">
          {job ? "Hosted record inspection" : "Live hardware demo"}
        </p>
        <h1>LIFERAFT</h1>
        <p>Start on the Raspberry Pi. Continue on Windows.</p>
      </header>
      <section className="live-card" aria-label="Training controls">
        {job ? (
          <p>Inspecting {job}. Launch controls are in live mode.</p>
        ) : (
          <>
            <button
              type="button"
              className="live-primary"
              disabled={
                starting ||
                !!error ||
                !connected ||
                !!busy ||
                !data?.controlsEnabled
              }
              onClick={() => void start()}
            >
              {starting ? "Starting training…" : "Start Training"}
            </button>
            <p role="status">
              {armed && health?.ready_for_drill && !error
                ? "Press the physical ESP32 button now."
                : data?.run?.phase === "failed"
                  ? "The previous job could not be created. Check the coordinator and retry when ready."
                  : busy
                    ? "Run active. Wait for the physical button prompt."
                    : data && !data.controlsEnabled
                      ? "Launch controls are disabled on this cockpit."
                      : connected
                        ? "All three device agents are ready."
                        : "Waiting for the Raspberry Pi, Windows standby and ESP32 bridge."}
            </p>
          </>
        )}
        {error || startError ? (
          <p className="live-error" role="alert">
            {startError || error} {data ? "Showing last verified data." : ""}
          </p>
        ) : null}
        <form onSubmit={select}>
          <label htmlFor="live-job">Verify an earlier Pi job</label>
          <input
            id="live-job"
            placeholder="pi-mvp-03"
            value={input}
            onChange={(event) => setInput(event.target.value)}
          />
          <button type="submit">Verify job</button>
          {job ? (
            <button
              type="button"
              onClick={() => {
                setJob("");
                setInput("");
                setData(null);
                setError("");
              }}
            >
              Back to live
            </button>
          ) : null}
        </form>
      </section>
      {!job && (
        <section className="live-grid" aria-label="Device readiness">
          {(Object.keys(roles) as Role[]).map((role) => {
            const device = data?.run?.devices[role];
            return (
              <article className="live-card" key={role}>
                <h2>{roles[role]}</h2>
                <p>
                  {device
                    ? stages[device.stage]
                    : data?.ready[role]
                      ? "Agent ready"
                      : "Agent offline or unavailable"}
                </p>
                {device?.reason && (
                  <p className="live-error">
                    {device.reason.replaceAll("_", " ")}. Check this device’s
                    terminal.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
      <section className="live-card" aria-label="Verified handoff">
        <h2>
          {proof?.verified_resumed ? "Handoff verified" : "Handoff evidence"}
        </h2>
        <dl className="live-facts">
          <div>
            <dt>Job</dt>
            <dd>{data?.job ?? data?.run?.job ?? "Waiting"}</dd>
          </div>
          <div>
            <dt>Coordinator state</dt>
            <dd>{health?.state.replaceAll("_", " ") ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Active owner</dt>
            <dd>{health?.owner ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Pi CPU</dt>
            <dd>
              {piTemp?.cpu_c == null
                ? "Unknown"
                : `${piTemp.cpu_c.toFixed(1)} °C measured`}
            </dd>
          </div>
          <div>
            <dt>Trigger</dt>
            <dd>
              {trigger
                ? "ESP32 · injected cooling drill"
                : (data?.replay?.trigger?.kind
                    .replaceAll("_", " ")
                    .toLowerCase() ?? "Waiting")}
            </dd>
          </div>
          <div>
            <dt>Checkpoint</dt>
            <dd>
              {proof?.checkpoint
                ? `${proof.checkpoint.producer} · step ${proof.checkpoint.step} · ${proof.checkpoint.hash_prefix}`
                : health?.checkpoint
                  ? `Step ${health.checkpoint.step} · ${health.checkpoint.sha256_prefix}`
                  : "Waiting"}
            </dd>
          </div>
          <div>
            <dt>First resumed step</dt>
            <dd>
              {proof?.resumed
                ? `${proof.resumed.worker_id} · step ${proof.resumed.step} · epoch ${proof.resumed.epoch}`
                : "Waiting"}
            </dd>
          </div>
          <div>
            <dt>Completed steps lost</dt>
            <dd>{proof?.rpo_steps ?? "Unknown"}</dd>
          </div>
          <div>
            <dt>Time to resume</dt>
            <dd>
              {proof?.rto_ms == null
                ? "Unknown"
                : `${(proof.rto_ms / 1000).toFixed(2)} s`}
            </dd>
          </div>
        </dl>
        {health?.reasons.length ? (
          <p className="live-note">
            Readiness checks ·{" "}
            {health.reasons
              .map((reason) => reason.replaceAll("_", " "))
              .join(" · ")}
          </p>
        ) : null}
      </section>
      {feed && <WorkerLogPanel feed={feed} error={error} />}
      <section className="live-grid" aria-label="Provider evidence">
        <article className="live-card">
          <h2>Nemotron</h2>
          <p>
            {data?.replay?.investigation_rejected
              ? "Investigation evidence failed verification"
              : (data?.providers.nemotron ??
                "No verified investigation available")}
          </p>
          {report && (
            <>
              <p>At analysis time: {report.outcome}</p>
              <ul>
                {report.facts.map((fact, index) => (
                  <li key={index}>{fact.text}</li>
                ))}
              </ul>
            </>
          )}
        </article>
        <article className="live-card">
          <h2>Photon</h2>
          <p>{data?.providers.photon ?? "No runner status available"}</p>
          <p>
            {receipt
              ? `Latest verified event: ${receipt.kind.replaceAll("_", " ").toLowerCase()}`
              : "No provider event observed"}
          </p>
        </article>
      </section>
      {data?.providers.diagnostic && (
        <p className="live-error">{data.providers.diagnostic}</p>
      )}
      {data?.replay && (
        <details className="live-card">
          <summary>
            Flight recorder · {data.replay.journal.count} verified events
          </summary>
          <ol className="live-events">
            {[...data.replay.events].reverse().map((event) => (
              <li key={event.id}>
                <time dateTime={event.at}>{event.at}</time> · {event.kind} ·{" "}
                {event.source} · {event.worker ?? "unknown worker"} ·{" "}
                {event.hash}
              </li>
            ))}
          </ol>
        </details>
      )}
    </main>
  );
}
