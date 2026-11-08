"use client";
import { useMemo } from "react";
import { useCockpit, select } from "../../lib/store/cockpit-store";
import { epochs } from "../../lib/derive/epochs";
import { EvidenceTrace } from "../ui/EvidenceTrace";
import { utc } from "../../lib/replay";
import { Badge, PanelTitle } from "../ui";
export function OwnershipEpochs() {
  const r = useCockpit((s) => s.replay),
    cursor = useCockpit((s) => s.cursor);
  const lanes = useMemo(() => epochs(r), [r]),
    max = Math.max(1, ...lanes.map((l) => l.last));
  return (
    <section className="panel epochs-panel">
      <PanelTitle
        icon="link"
        title="Ownership epochs"
        detail={<Badge source={r ? "derived" : "no data"} />}
      />
      {lanes.length ? (
        lanes.map((l) => (
          <EvidenceTrace id={l.eventId} key={l.epoch}>
            <button
              className={`epoch-lane ${l.seq > (r?.events[cursor]?.seq ?? 0) ? "future" : ""}`}
              onClick={() => select(l.eventId)}
            >
              <span>
                <strong>Epoch {l.epoch}</strong>
                <small>{l.worker}</small>
              </span>
              <div className="epoch-track">
                <i
                  style={{
                    marginLeft: `${(l.first / max) * 85}%`,
                    width: `${Math.max(4, ((l.last - l.first) / max) * 85)}%`,
                    background: l.epoch === 1 ? "var(--blue)" : "var(--teal)",
                  }}
                />
              </div>
              <span className="mono">
                {l.first}–{l.last} · {l.checkpoints} commits
              </span>
              <small>
                {l.reason.toLowerCase().replaceAll("_", " ")}
                <br />
                {utc(l.start)} → {utc(l.end)}
              </small>
            </button>
          </EvidenceTrace>
        ))
      ) : (
        <p className="empty-state">No ownership evidence in this replay.</p>
      )}
      <p className="subtle">
        Increasing epochs fence previous owners. Step ranges come from recorded
        events and measured losses.
      </p>
    </section>
  );
}
