"use client";
import { useCockpit, select } from "../../lib/store/cockpit-store";
import { beats } from "../../lib/derive/timeline";
import { Badge, PanelTitle } from "../ui";
export function RecoveryProof() {
  const r = useCockpit((s) => s.replay),
    p = r?.recovery;
  const b = beats(r);
  const metrics = [
    [
      "Recovery time",
      p?.rto_ms != null ? (p.rto_ms / 1000).toFixed(3) : null,
      "s",
    ],
    ["Work lost", p?.rpo_steps, "steps"],
    ["Last recorded step", r?.progress?.step, ""],
    ["Ownership epoch", p?.resumed?.epoch, ""],
  ];
  return (
    <section className="panel recovery-panel" aria-label="Recovery proof">
      <PanelTitle
        icon="shield"
        title="Recovery proof"
        detail={<Badge source={p?.verified_resumed ? "derived" : "no data"} />}
      />
      <div className="proof">
        <span className="kicker">CHECKPOINT → FIRST RESUMED STEP</span>
        <div className="continuity">
          <button disabled={!b[1]} onClick={() => b[1] && select(b[1].id)}>
            <strong>{p?.checkpoint?.step ?? "—"}</strong>
            <small>Saved on primary</small>
          </button>
          <span aria-hidden="true">→</span>
          <button disabled={!b[3]} onClick={() => b[3] && select(b[3].id)}>
            <strong>{p?.resumed?.step ?? "—"}</strong>
            <small>Measured on standby</small>
          </button>
        </div>
        <button
          className="fence text-button"
          disabled={!b[2]}
          onClick={() => b[2] && select(b[2].id)}
        >
          Ownership fence · {p?.checkpoint?.producer ?? "unknown"} →{" "}
          {p?.resumed?.worker_id ?? "unknown"}
        </button>
        <p className={p?.verified_resumed ? "verified" : "warning"}>
          {p?.verified_resumed
            ? "✓ Recovery verified"
            : "○ Awaiting verified recovery"}
          {p?.verified_resumed && p.completed_after_resume
            ? " · Training completed"
            : ""}
        </p>
      </div>
      <dl className="metrics">
        {metrics.map(([label, value, unit]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {value ?? "—"} <small>{value != null ? unit : ""}</small>
              <span className="metric-badge">
                <Badge source={value != null ? "derived" : "no data"} />
              </span>
            </dd>
          </div>
        ))}
      </dl>
      {!!p?.unknowns.length && (
        <details open className="proof-notes">
          <summary>Verification limits</summary>
          <ul>
            {p.unknowns.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
