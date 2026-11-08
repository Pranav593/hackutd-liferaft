"use client";

import { useEffect, useState } from "react";
import "./worker-logs.css";

type LogRow = {
  job: string;
  worker: string;
  at: string;
  kind: string;
  source: string;
  origin: string;
  metrics: Record<string, number | string>;
};
type DeviceLog = {
  worker: string;
  title: string;
  state: "waiting" | "saved" | "finished" | "active" | "stale" | "failed";
  age_s: number | null;
  rows: LogRow[];
};
type Feed = {
  job: string | null;
  mode: "waiting" | "local" | "cloud" | "saved";
  notice: string;
  checked_at: string;
  devices: DeviceLog[];
  other_workers: string[];
};
const waiting: DeviceLog[] = [
  {
    worker: "pi-primary",
    title: "Raspberry Pi",
    state: "waiting",
    age_s: null,
    rows: [],
  },
  {
    worker: "laptop-standby",
    title: "Windows computer",
    state: "waiting",
    age_s: null,
    rows: [],
  },
];
const stateLabels = {
  failed: "Worker stopped with an error",
  waiting: "Waiting for logs",
  saved: "Saved activity",
  finished: "Session ended / yielded",
  active: "Recent activity",
  stale: "No recent activity",
};

export function WorkerLogs() {
  const [feed, setFeed] = useState<Feed | null>(null);
  const [error, setError] = useState("");
  const [paused, setPaused] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (paused) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      try {
        if (document.visibilityState !== "hidden") {
          const response = await fetch("/api/worker-logs", {
            cache: "no-store",
            signal: controller.signal,
          });
          const payload = await response.json();
          if (!response.ok)
            throw new Error(payload.error ?? "Log updates unavailable.");
          if (!stopped) {
            setFeed(payload);
            setError("");
          }
        }
      } catch (reason) {
        if (!stopped && reason instanceof Error && reason.name !== "AbortError")
          setError(reason.message);
      } finally {
        if (!stopped) timer = setTimeout(refresh, 3000);
      }
    }
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [paused, revision]);

  return (
    <section className="worker-logs" aria-labelledby="worker-log-title">
      <div className="worker-logs-heading">
        <div>
          <h2 id="worker-log-title">Training activity</h2>
          <p>
            {feed?.job
              ? `Job ${feed.job} · selected automatically`
              : "Finding the current training job automatically…"}
          </p>
        </div>
        <div className="worker-log-actions">
          <span>
            {feed?.mode === "cloud"
              ? "LIVE COORDINATOR"
              : feed?.mode === "local"
                ? "LOCAL LOGS"
                : feed?.mode === "saved"
                  ? "SAVED RECORD"
                  : "NOT CONNECTED"}
          </span>
          <button onClick={() => setPaused(!paused)}>
            {paused ? "Resume updates" : "Pause updates"}
          </button>
          <button
            aria-label="Refresh worker logs"
            onClick={() => {
              setPaused(false);
              setRevision(revision + 1);
            }}
          >
            ↻
          </button>
        </div>
      </div>
      <p className="worker-log-notice">
        {error ||
          feed?.notice ||
          "Read-only logs. Device feeds stay empty until activity is observed."}
      </p>
      {paused ? (
        <p className="worker-log-notice" role="status">
          Updates paused. Displayed activity is frozen.
        </p>
      ) : null}
      <div className="worker-log-grid">
        {(feed?.devices ?? waiting).map((device) => {
          const latest = device.rows.at(-1);
          const step = [...device.rows]
            .reverse()
            .find(
              (row) =>
                row.metrics.step_completed !== undefined ||
                row.metrics.step !== undefined,
            );
          const os = [...device.rows].reverse().find((row) => row.metrics.os)
            ?.metrics.os;
          return (
            <article
              className="worker-log-device"
              key={device.worker}
              aria-label={`${device.title} training logs`}
            >
              <div className="worker-log-device-heading">
                <div>
                  <h3>{device.title}</h3>
                  <p>
                    {device.worker}
                    {os ? ` · ${os}` : " · OS not reported"}
                  </p>
                </div>
                <span className={`worker-log-state ${device.state}`}>
                  {error
                    ? "Updates unavailable"
                    : paused
                      ? "Paused"
                      : stateLabels[device.state]}
                </span>
              </div>
              <div className="worker-log-metrics">
                <span>
                  Latest step{" "}
                  <b>
                    {step
                      ? (step.metrics.step_completed ?? step.metrics.step)
                      : "—"}
                  </b>
                </span>
                <span>
                  Last event{" "}
                  <b>
                    {latest
                      ? `${new Date(latest.at).toISOString().slice(11, 19)} UTC`
                      : "Not received"}
                  </b>
                </span>
              </div>
              <div
                className="worker-log-terminal"
                tabIndex={0}
                role="region"
                aria-label={`${device.title} recent output`}
              >
                {device.rows.length ? (
                  [...device.rows].reverse().map((row, index) => (
                    <div
                      className="worker-log-line"
                      key={`${row.at}-${row.kind}-${row.origin}-${index}`}
                    >
                      <time dateTime={row.at}>
                        {new Date(row.at).toISOString().slice(11, 23)}
                      </time>
                      <div>
                        <strong>
                          {row.kind.toLowerCase().replaceAll("_", " ")}
                        </strong>
                        <span>
                          {Object.entries(row.metrics)
                            .filter(([key]) => key !== "os")
                            .map(
                              ([key, value]) =>
                                `${key}=${typeof value === "number" && !Number.isInteger(value) ? value.toFixed(key === "loss" ? 6 : 2) : value}`,
                            )
                            .join(" · ")}
                        </span>
                        <small>
                          {row.source} · {row.origin}
                        </small>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="worker-log-empty">
                    No {device.title} activity received.
                    <br />
                    Start the worker against the shared coordinator; the
                    dashboard will follow its job.
                  </div>
                )}
              </div>
            </article>
          );
        })}
      </div>
      <p className="worker-log-footnote">
        Newest entries first · UTC · logs do not establish recovery proof
        {feed?.other_workers.length
          ? ` · Other recorded workers: ${feed.other_workers.join(", ")} (not relabeled as Pi or Windows)`
          : ""}
        {feed
          ? ` · Checked ${new Date(feed.checked_at).toISOString().slice(11, 19)}`
          : ""}
      </p>
    </section>
  );
}
