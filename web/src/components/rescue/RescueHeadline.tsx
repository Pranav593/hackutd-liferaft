"use client";
import { useCockpit, select } from "../../lib/store/cockpit-store";
import { narrative } from "../../lib/derive/narrative";
import { beats } from "../../lib/derive/timeline";
import { Badge } from "../ui";
import { Skeleton } from "../ui/primitives";
import { Copy } from "../ui/primitives";
export function RescueHeadline() {
  const r = useCockpit((s) => s.replay),
    loading = useCockpit((s) => s.status === "loading" || s.status === "idle");
  const n = narrative(r);
  return (
    <div className="rescue-headline" aria-busy={loading}>
      {loading ? (
        <Skeleton />
      ) : (
        <>
          <span className="kicker">COMPUTE CONTINUITY / SAVED EVIDENCE</span>
          <h1 className={n.verified ? "verified" : ""}>
            {n.title.split(" ").slice(0, -1).join(" ")}{" "}
            <em>{n.title.split(" ").at(-1)}</em>
          </h1>
          <p>{n.detail}</p>
          <Badge source={r ? "derived" : "no data"} />
          {!r && (
            <div className="setup-command">
              <p>
                Generate local evidence, then use the printed directory as the
                local run. PowerShell, from the repository root:
              </p>
              <pre>
                {
                  '.\\.venv\\Scripts\\python.exe -m liferaft demo --scenario cooling-test\n$env:LIFERAFT_COCKPIT_JOB = "local-job"\n$env:LIFERAFT_COCKPIT_LOCAL_RUN = ".liferaft/phase2-REPLACE_ME"\nnpm run dev'
                }
              </pre>
              <Copy
                text={
                  ".\\.venv\\Scripts\\python.exe -m liferaft demo --scenario cooling-test"
                }
                label="Copy evidence command"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
export function RescueStrip() {
  const r = useCockpit((s) => s.replay),
    id = useCockpit((s) => s.selectedId);
  const events = beats(r);
  const p = r?.recovery;
  const labels = ["Trigger", "Save", "Handoff", "Proof"];
  const detail = [
    r?.trigger
      ? `${r.trigger.source === "injected" ? "Cooling drill (injected)" : "Recorded incident"} · ${r.trigger.sensor ? "ESP32 button" : "coordinator"}`
      : "No trigger recorded",
    p?.checkpoint
      ? `Checkpoint ${p.checkpoint.step} · sha ${p.checkpoint.hash_prefix}`
      : "No checkpoint evidence",
    p?.resumed
      ? `Epoch ${p.checkpoint?.epoch ?? "?"} → ${p.resumed.epoch} · ${p.resumed.worker_id}`
      : "No handoff evidence",
    p?.resumed
      ? `Step ${p.resumed.step} · loss ${p.resumed.loss.toPrecision(5)}`
      : "No resumed step",
  ];
  return (
    <div className="rescue-strip" aria-label="Four beats of recovery">
      {labels.map((label, i) => (
        <button
          key={label}
          disabled={!events[i]}
          aria-pressed={id === events[i]?.id}
          onClick={() => events[i] && select(events[i]!.id)}
          className={`rescue-beat ${!events[i] ? "absent" : ""}`}
        >
          <span className="beat-number">0{i + 1}</span>
          <span>
            <strong>{label}</strong>
            <small>{detail[i]}</small>
            <Badge source={events[i]?.source ?? "no data"} />
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      ))}
    </div>
  );
}
