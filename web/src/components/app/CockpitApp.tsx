"use client";
import { useEffect, useRef, useState } from "react";
import {
  useCockpit,
  load,
  update,
  step,
  setCursor,
  syncUrl,
} from "../../lib/store/cockpit-store";
import { milestones } from "../../lib/derive/timeline";
import { dashboardStory } from "../../lib/derive/dashboard";
import { eventName, utc } from "../../lib/replay";
import { Icon } from "../ui";
import { Copy } from "../ui/primitives";
import { DetailDialog, type DetailView } from "../dashboard/DetailDialog";
import { DashboardCards } from "../dashboard/DashboardCards";
import { WorkerLogs } from "../workers/WorkerLogs";
export function CockpitApp() {
  const r = useCockpit((s) => s.replay),
    status = useCockpit((s) => s.status),
    error = useCockpit((s) => s.error),
    cursor = useCockpit((s) => s.cursor),
    id = useCockpit((s) => s.selectedId),
    playing = useCockpit((s) => s.playing),
    speed = useCockpit((s) => s.speed),
    filters = useCockpit((s) => s.filters),
    topologyMode = useCockpit((s) => s.topologyMode);
  const [view, setView] = useState<DetailView | null>(null),
    help = useRef<HTMLDialogElement>(null);
  const story = dashboardStory(r),
    loading = status === "loading" || status === "idle",
    simulated = r?.events.some((e) => e.source === "simulated"),
    event = r?.events[cursor];
  const open = (next: DetailView) => {
    update({ playing: false });
    setView(next);
  };
  useEffect(() => {
    void load();
    try {
      const saved = localStorage.getItem("liferaft.motion.v1");
      if (saved === "system" || saved === "reduced" || saved === "full")
        update({ motion: saved });
    } catch {}
  }, []);
  useEffect(() => syncUrl(), [cursor, id, filters.scope, topologyMode, status]);
  useEffect(() => {
    if (!playing || !r) return;
    if (cursor >= r.events.length - 1) {
      update({ playing: false });
      return;
    }
    const timer = setTimeout(
      () => step(1),
      (milestones.has(r.events[cursor]?.kind) ? 900 : 250) / speed,
    );
    return () => clearTimeout(timer);
  }, [playing, cursor, r, speed]);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target instanceof HTMLElement &&
          e.target.closest("input,textarea,select,[contenteditable],dialog"))
      )
        return;
      if (e.key === "?") help.current?.showModal();
      else if (e.key === "/") {
        e.preventDefault();
        setView("timeline");
        requestAnimationFrame(() =>
          document.getElementById("event-search")?.focus(),
        );
      } else if (["j", "k", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        step(e.key === "j" || e.key === "ArrowLeft" ? -1 : 1, e.shiftKey);
      } else if (e.key === "0") update({ camera: null });
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  return (
    <>
      <a href="#dashboard" className="skip-link">
        Skip to dashboard
      </a>
      <header className="dashboard-header">
        <a href="/" className="dashboard-brand" aria-label="Liferaft home">
          <Icon name="raft" size={26} />
          <span>
            liferaft<span className="brand-period">.</span>
          </span>
        </a>
        <span className="header-purpose">
          Good work deserves
          <br />a safe place to land.
        </span>
        <div className="header-actions">
          <span className="saved-mode">
            <i />
            Saved replay
          </span>
          <button className="header-evidence" onClick={() => open("timeline")}>
            Explore the evidence <span aria-hidden="true">↗</span>
          </button>
          <button
            className="reverify-button"
            disabled={loading}
            onClick={() => void load()}
            aria-label="Re-verify saved evidence"
          >
            {loading ? "Checking…" : "Re-verify"}{" "}
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </header>
      <main id="dashboard" className="dashboard-shell" aria-busy={loading}>
        <div className="dashboard-heading">
          <div>
            <span className="eyebrow">COMPUTE CONTINUITY, MADE CLEAR</span>
            <h1>
              A little backup. <em>A lot of reassurance.</em>
            </h1>
          </div>
          <div className="run-caption">
            <span>{r?.job ?? "No run selected"}</span>
            <small>
              {loading ? "Checking the saved record…" : story.context}
            </small>
          </div>
        </div>
        {error && (
          <div className="dashboard-alert" role="alert">
            <div>
              <strong>We couldn’t open this record.</strong>
              <p>{error}</p>
            </div>
            <button onClick={() => void load()} disabled={loading}>
              Try again
            </button>
          </div>
        )}
        {simulated && (
          <div className="simulation-notice" role="status">
            ▲ SIMULATED — This record includes synthetic events. Do not treat
            them as observed.
          </div>
        )}
        <DashboardCards
          replay={r}
          cursor={cursor}
          loading={loading}
          open={open}
        />
        <div
          className="dashboard-transport"
          role="group"
          aria-label="Replay transport"
        >
          <div className="transport-label">
            <span className="transport-dot" />
            Replay the rescue<small>Saved events, not a live feed</small>
          </div>
          <div className="transport-buttons">
            <button
              aria-label="First event"
              disabled={!r}
              onClick={() => setCursor(0)}
            >
              ↤
            </button>
            <button
              aria-label={playing ? "Pause replay" : "Play replay"}
              disabled={!r}
              onClick={() => {
                if (cursor === r!.events.length - 1) setCursor(0);
                update({ playing: !playing });
              }}
            >
              {playing ? "Ⅱ" : "▶"}
            </button>
            <button
              aria-label="Next event"
              disabled={!r || cursor === r.events.length - 1}
              onClick={() => step(1)}
            >
              →
            </button>
          </div>
          <input
            type="range"
            aria-label="Replay event"
            min={0}
            max={Math.max(0, (r?.events.length ?? 1) - 1)}
            value={Math.max(0, cursor)}
            disabled={!r}
            onChange={(e) => setCursor(Number(e.target.value))}
            aria-valuetext={
              event
                ? `${eventName(event.kind)} at ${utc(event.at)}`
                : "No events"
            }
          />
          <span className="transport-current">
            {event
              ? `${cursor + 1} / ${r!.events.length} · ${utc(event.at)}`
              : "No saved events"}
          </span>
          <button className="transport-detail" onClick={() => open("devices")}>
            Devices & messages ↗
          </button>
        </div>
        <footer className="dashboard-footer">
          <span>Made to keep work moving.</span>
          <div>
            <span>
              {r
                ? `${r.journal.anchored ? "Anchored" : "Unanchored"} record · details explain verification limits`
                : "Select a saved run to begin"}
            </span>
            <button onClick={() => help.current?.showModal()}>
              How to read this <span aria-hidden="true">?</span>
            </button>
          </div>
        </footer>
        {!r && !loading && !error && (
          <details className="setup-guide">
            <summary>Open your first saved run</summary>
            <p>
              From the repository root, generate a local run. Then use its
              printed directory as LIFERAFT_COCKPIT_LOCAL_RUN and set
              LIFERAFT_COCKPIT_JOB to local-job.
            </p>
            <pre>
              {
                ".\\.venv\\Scripts\\python.exe -m liferaft demo --scenario cooling-test"
              }
            </pre>
            <Copy
              text={
                ".\\.venv\\Scripts\\python.exe -m liferaft demo --scenario cooling-test"
              }
              label="Copy evidence command"
            />
          </details>
        )}
      </main>
      <WorkerLogs />
      <DetailDialog
        view={view}
        onView={setView}
        onClose={() => setView(null)}
      />
      <dialog
        ref={help}
        className="reading-guide"
        aria-labelledby="reading-title"
      >
        <span className="kicker">A QUICK ORIENTATION</span>
        <h2 id="reading-title">
          Start with the story.
          <br />
          <em>Then check the proof.</em>
        </h2>
        <p>
          LIFERAFT saves an AI training job’s progress so another worker can
          continue when the first needs to stop. This dashboard shows a saved
          record of that process.
        </p>
        <ol>
          <li>
            <strong>Read the five cards.</strong> They explain the outcome,
            handoff, alarm, progress and next action.
          </li>
          <li>
            <strong>Open any card.</strong> The technical records, charts and
            uncertainty are one click away.
          </li>
          <li>
            <strong>Use the replay.</strong> The worker diagram follows the
            selected event. The outcome card always summarizes the whole record.
          </li>
        </ol>
        <p>
          “Injected” means a practice alarm. “Measured” means something the
          system actually observed. “No data” means the record cannot tell us.
        </p>
        <button onClick={() => help.current?.close()} className="solid-button">
          Got it
        </button>
      </dialog>
    </>
  );
}
