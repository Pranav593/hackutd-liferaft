"use client";
import { useCockpit, select } from "../../lib/store/cockpit-store";
import { Badge, PanelTitle } from "../ui";
export function NemotronEvidence() {
  const r = useCockpit((s) => s.replay),
    t = r?.investigation;
  const chips = (ids: string[]) =>
    ids.map((id) => {
      const e = r?.events.find((e) => e.id === id);
      return (
        e && (
          <button className="filter-chip" key={id} onClick={() => select(id)}>
            Event {e.seq} ↗
          </button>
        )
      );
    });
  return (
    <section className="panel nemotron-panel">
      <PanelTitle
        icon="spark"
        title="Nemotron evidence"
        detail={<Badge source={t ? "provider" : "no data"} />}
      />
      <p className="advisory">
        Advisory. Read-only tools. Cannot change a lease, checkpoint or status.
      </p>
      {t ? (
        <>
          <p className="mono">{t.model}</p>
          <ul className="tool-list">
            {t.tools.map((tool, i) => (
              <li key={`${tool.name}-${i}`}>
                <details>
                  <summary>
                    <code>{tool.name}</code> · {tool.event_ids.length} cited
                    events <Badge source="provider" />
                  </summary>
                  <div className="related-events">{chips(tool.event_ids)}</div>
                </details>
              </li>
            ))}
          </ul>
          {t.facts.map((fact, i) => (
            <div key={i} className="trace-fact">
              <p>{fact.text}</p>
              {fact.evidence_event_ids.some((id) =>
                r?.events.some((e) => e.id === id),
              ) ? (
                chips(fact.evidence_event_ids)
              ) : (
                <span className="warning">Uncited</span>
              )}
            </div>
          ))}
          <h3>Uncertainty</h3>
          <p className="warning">{t.uncertainty}</p>
          <h3>
            Outcome <Badge source="provider" />
          </h3>
          <p>{t.outcome}</p>
        </>
      ) : (
        <p className="empty-state">
          {r?.investigation_rejected
            ? "Saved investigation failed validation."
            : "No saved investigation attached to this incident."}
        </p>
      )}
    </section>
  );
}
