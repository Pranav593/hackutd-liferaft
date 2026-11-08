"use client";
import { useEffect, useRef, useState } from "react";
import {
  useCockpit,
  load,
  update,
  step,
  setCursor,
  getState,
  syncUrl,
  select,
} from "../../lib/store/cockpit-store";
import { milestones, beats } from "../../lib/derive/timeline";
import { eventName } from "../../lib/replay";
import { Icon, Badge } from "../ui";
import { RescueHeadline, RescueStrip } from "../rescue/RescueHeadline";
import { RecoveryProof } from "../proof/RecoveryProof";
import { ReplayScrubber } from "../scrubber/ReplayScrubber";
import { TopologyStage } from "../topology/TopologyStage";
import { LossChart } from "../training/LossChart";
import { OwnershipEpochs } from "../training/OwnershipEpochs";
import { CheckpointLedger } from "../training/CheckpointLedger";
import { FlightRecorder } from "../recorder/FlightRecorder";
import { Inspector } from "../recorder/Inspector";
import { HandoffBrief } from "../intelligence/HandoffBrief";
import { NemotronEvidence } from "../intelligence/NemotronEvidence";
import {
  OperatorComms,
  SensorEvidence,
  Readiness,
} from "../operators/OperatorEvidence";
import { Skeleton } from "../ui/primitives";
function SectionTitle({
  number,
  title,
  accent,
  id,
}: {
  number: string;
  title: string;
  accent: string;
  id: string;
}) {
  return (
    <h2 className="section-title" id={id}>
      <span>{number}</span>
      {title} <em>{accent}</em>
      <i />
    </h2>
  );
}
export function CockpitApp() {
  const r = useCockpit((s) => s.replay),
    status = useCockpit((s) => s.status),
    error = useCockpit((s) => s.error),
    cursor = useCockpit((s) => s.cursor),
    id = useCockpit((s) => s.selectedId),
    playing = useCockpit((s) => s.playing),
    speed = useCockpit((s) => s.speed),
    filters = useCockpit((s) => s.filters),
    motion = useCockpit((s) => s.motion),
    topologyMode = useCockpit((s) => s.topologyMode);
  const help = useRef<HTMLDialogElement>(null);
  const [mobile, setMobile] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<
    "recorder" | "ledger" | "nemotron"
  >("recorder");
  useEffect(() => {
    const media = matchMedia("(max-width:899px)");
    const changed = () => setMobile(media.matches);
    changed();
    media.addEventListener("change", changed);
    return () => media.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    let originals: [HTMLDetailsElement, boolean][] = [];
    const before = () => {
      originals = [
        ...document.querySelectorAll<HTMLDetailsElement>(
          "details.section-disclosure",
        ),
      ].map((d) => [d, d.open]);
      originals.forEach(([d]) => {
        d.open = true;
      });
    };
    const after = () => {
      originals.forEach(([d, open]) => {
        d.open = open;
      });
      originals = [];
    };
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);
  useEffect(() => {
    void load();
    try {
      const saved = localStorage.getItem("liferaft.motion.v1");
      if (["system", "reduced", "full"].includes(saved ?? ""))
        update({ motion: saved as typeof motion });
    } catch {}
  }, []);
  useEffect(() => {
    syncUrl();
  }, [cursor, id, filters.scope, topologyMode, status]);
  useEffect(() => {
    if (!playing || !r) return;
    if (cursor >= r.events.length - 1) {
      update({ playing: false });
      return;
    }
    const dwell = milestones.has(r.events[cursor]?.kind) ? 900 : 250;
    const timer = setTimeout(() => step(1), dwell / speed);
    return () => clearTimeout(timer);
  }, [playing, cursor, r, speed]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        (e.target instanceof HTMLElement &&
          e.target.closest(
            "input,textarea,select,[contenteditable],dialog,[role=dialog]",
          ))
      )
        return;
      const s = getState();
      if (e.key === "/") {
        e.preventDefault();
        setMobilePanel("recorder");
        requestAnimationFrame(() =>
          document.getElementById("event-search")?.focus(),
        );
      } else if (e.key === "?") {
        help.current?.showModal();
      } else if (e.key === "Escape") {
        update({ inspectorOpen: false, camera: null });
      } else if (e.key === "0") {
        update({ camera: null });
      } else if (["j", "k", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        step(e.key === "j" || e.key === "ArrowLeft" ? -1 : 1, e.shiftKey);
      } else if (
        e.key === " " &&
        e.target instanceof HTMLElement &&
        e.target.closest(".scrubber") &&
        e.target.tagName !== "BUTTON"
      ) {
        e.preventDefault();
        if (s.cursor === s.replay?.events.length! - 1) setCursor(0);
        update({ playing: !s.playing });
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  const simulated = r?.events.some((e) => e.source === "simulated"),
    selected = r?.events.find((e) => e.id === id);
  const loading = status === "loading" || status === "idle";
  return (
    <>
      <a className="skip-link" href="#rescue">
        Skip to rescue
      </a>
      <a className="skip-link" href="#recorder">
        Skip to flight recorder
      </a>
      <header className="site-header">
        <div className="shell header-inner">
          <a href="/" className="brand">
            <span className="brand-icon">
              <Icon name="raft" size={24} />
            </span>
            <strong>
              LIFE<span>RAFT</span>
              <small>CONTINUITY CONTROL</small>
            </strong>
          </a>
          <span className="header-job mono">
            {r?.job ?? "NO JOURNAL SELECTED"}
          </span>
          <span className="mode-chip">● REPLAY · SAVED EVIDENCE</span>
          <span
            className={`header-chain mono ${r && !r.journal.anchored ? "warning" : ""}`}
            title={
              r?.journal.anchored
                ? "Export head verified"
                : "Chain links verified; no export head anchor"
            }
          >
            {r
              ? r.journal.anchored
                ? "✓ Anchored chain"
                : "◇ Legacy chain"
              : "○ No chain"}
          </span>
          <button
            className="button small"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? "Checking…" : "Re-verify"}{" "}
            <span aria-hidden="true">↻</span>
          </button>
        </div>
      </header>
      <main
        data-loading={loading}
        className={`shell cockpit ${r?.recovery.verified_resumed ? "is-verified" : ""}`}
      >
        <div
          className={`mode-banner ${error ? "failed" : ""} ${simulated ? "simulated" : ""}`}
          role={error ? "alert" : "status"}
        >
          <span>
            <strong>
              {error
                ? "Replay unavailable"
                : simulated
                  ? "▲ SIMULATED · Contains simulated events. Do not treat as observed."
                  : loading
                    ? "Checking saved evidence"
                    : r
                      ? r.mode === "local"
                        ? "Local two-process replay"
                        : "Saved coordinator replay"
                      : "No saved journal configured"}
            </strong>
            <span>
              {error ||
                "Historical evidence. Node state follows the cursor; the recovery verdict summarizes the entire verified record."}
            </span>
          </span>
          {error && (
            <button
              className="button"
              onClick={() => void load()}
              disabled={loading}
            >
              Retry
            </button>
          )}
          <label className="motion-control">
            Motion{" "}
            <select
              aria-label="Motion preference"
              value={motion}
              onChange={(e) => {
                const value = e.target.value as typeof motion;
                update({ motion: value });
                try {
                  localStorage.setItem("liferaft.motion.v1", value);
                } catch {}
              }}
            >
              <option value="system">System</option>
              <option value="reduced">Reduced</option>
              <option value="full">Full</option>
            </select>
          </label>
        </div>
        <section id="rescue" aria-labelledby="rescue-title" aria-busy={loading}>
          <SectionTitle
            number="01"
            title="The"
            accent="rescue"
            id="rescue-title"
          />
          <RescueHeadline />
          <RescueStrip />
          <div className="overview-grid">
            <TopologyStage />
            <RecoveryProof />
          </div>
        </section>
        <ReplayScrubber />
        <section
          id="proof"
          className="numbered-section"
          aria-labelledby="proof-title"
          aria-busy={loading}
        >
          <SectionTitle
            number="02"
            title="The"
            accent="proof"
            id="proof-title"
          />
          <details className="section-disclosure" open>
            <summary>Training continuity and checkpoints</summary>
            {loading ? (
              <Skeleton />
            ) : (
              <>
                <div className="proof-grid">
                  <LossChart />
                  <OwnershipEpochs />
                </div>
                {!mobile && <CheckpointLedger />}
              </>
            )}
          </details>
        </section>
        <section
          className="numbered-section"
          aria-labelledby="recorder-title"
          aria-busy={loading}
        >
          <SectionTitle
            number="03"
            title="Flight"
            accent="recorder"
            id="recorder-title"
          />
          {mobile && (
            <div
              className="segmented mobile-evidence-tabs"
              role="group"
              aria-label="Evidence view"
            >
              {(["recorder", "ledger", "nemotron"] as const).map((panel) => (
                <button
                  key={panel}
                  aria-pressed={mobilePanel === panel}
                  onClick={() => setMobilePanel(panel)}
                >
                  {panel === "ledger"
                    ? "Checkpoints"
                    : panel === "nemotron"
                      ? "Nemotron"
                      : "Events"}
                </button>
              ))}
            </div>
          )}
          <div className="recorder-grid">
            {!mobile || mobilePanel === "recorder" ? (
              <FlightRecorder />
            ) : mobilePanel === "ledger" ? (
              <CheckpointLedger />
            ) : (
              <NemotronEvidence />
            )}
            <Inspector />
          </div>
        </section>
        <section
          id="intelligence"
          className="numbered-section"
          aria-labelledby="intelligence-title"
        >
          <SectionTitle
            number="04"
            title=""
            accent="Intelligence"
            id="intelligence-title"
          />
          <details className="section-disclosure" open={!mobile}>
            <summary>Investigation and shift handoff</summary>
            <div className="intelligence-grid">
              {!mobile && <NemotronEvidence />}
              <HandoffBrief />
            </div>
          </details>
        </section>
        <section
          id="operators"
          className="numbered-section"
          aria-labelledby="operators-title"
        >
          <SectionTitle
            number="05"
            title=""
            accent="Operators"
            id="operators-title"
          />
          <details className="section-disclosure" open={!mobile}>
            <summary>Communications, sensors and readiness</summary>
            <div className="operators-grid">
              <OperatorComms />
              <SensorEvidence />
              <Readiness />
            </div>
          </details>
        </section>
        <footer>
          <span>LIFERAFT / EVIDENCE CONSOLE · v0.2</span>
          <span>
            {r
              ? `Snapshot ${new Date(r.journal.at).toISOString()} · head ${r.journal.head.slice(0, 12)}`
              : "No evidence snapshot"}{" "}
            <Badge source={r ? "derived" : "no data"} />
          </span>
          <button
            className="text-button"
            onClick={() => help.current?.showModal()}
          >
            Keyboard shortcuts ?
          </button>
        </footer>
        <span className="sr-only" aria-live="polite">
          {selected
            ? `Selected event ${selected.seq}, ${eventName(selected.kind)}`
            : ""}
        </span>
      </main>
      <nav className="section-nav" aria-label="Console sections">
        {[
          ["rescue", "Rescue"],
          ["proof", "Proof"],
          ["recorder", "Recorder"],
          ["intelligence", "Intel"],
          ["operators", "Ops"],
        ].map(([link, label]) => (
          <a key={link} href={`#${link}`}>
            {label}
          </a>
        ))}
      </nav>
      <dialog ref={help} className="shortcut-help">
        <h2>Keyboard shortcuts</h2>
        <p>← / → or J / K: previous / next event</p>
        <p>Shift + arrows: previous / next milestone</p>
        <p>Space in scrubber: play / pause</p>
        <p>0: overview and chart reset · /: search · Esc: close</p>
        <div className="related-events">
          {beats(r).map(
            (e, i) =>
              e && (
                <button
                  key={e.id}
                  className="filter-chip"
                  onClick={() => {
                    select(e.id);
                    help.current?.close();
                  }}
                >
                  Beat {i + 1} ↗
                </button>
              ),
          )}
        </div>
        <button className="button" onClick={() => help.current?.close()}>
          Close
        </button>
      </dialog>
    </>
  );
}
