"use client";
import { useMemo, useState } from "react";
import { useCockpit, select } from "../../lib/store/cockpit-store";
import { ledger } from "../../lib/derive/ledger";
import { utc } from "../../lib/replay";
import { Badge, PanelTitle } from "../ui";
import { relationIndex } from "../ui/EvidenceTrace";
import { trace } from "../../lib/store/hover-store";
import { Copy } from "../ui/primitives";
export function CheckpointLedger() {
  const r = useCockpit((s) => s.replay),
    cursor = useCockpit((s) => s.cursor),
    selected = useCockpit((s) => s.selectedId);
  const [ascending, setAscending] = useState(false);
  const rows = useMemo(() => ledger(r, ascending), [r, ascending]);
  return (
    <section className="panel ledger-panel">
      <PanelTitle
        icon="stack"
        title="Checkpoint ledger"
        detail={<Badge source={rows.length ? "derived" : "no data"} />}
      />
      {rows.length ? (
        <>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <button
                      className="text-button"
                      onClick={() => setAscending((v) => !v)}
                    >
                      Step {ascending ? "↑" : "↓"}
                    </button>
                  </th>
                  <th>Producer / epoch</th>
                  <th>SHA-256 prefix</th>
                  <th>Committed (UTC)</th>
                  <th>Status / evidence</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr
                    key={e.id}
                    onMouseEnter={() =>
                      trace(relationIndex(r)?.get(e.id)?.eventIds ?? null)
                    }
                    onMouseLeave={() => trace(null)}
                    onFocus={() =>
                      trace(relationIndex(r)?.get(e.id)?.eventIds ?? null)
                    }
                    onBlur={() => trace(null)}
                    className={`${e.seq > (r?.events[cursor]?.seq ?? 0) ? "future" : ""} ${selected === e.id ? "selected" : ""}`}
                  >
                    <td>
                      <button
                        className="text-button"
                        onClick={() => select(e.id)}
                      >
                        {e.step}
                      </button>
                    </td>
                    <td>
                      {e.worker}
                      <small>Epoch {e.epoch}</small>
                    </td>
                    <td>
                      <code>{e.hash_prefix}</code>
                      <Copy text={e.hash_prefix!} label="Copy prefix" />
                    </td>
                    <td>
                      <time dateTime={e.at}>{utc(e.at)}</time>
                    </td>
                    <td>
                      <button
                        className="text-button"
                        onClick={() => select(e.id)}
                      >
                        {e.used ? "Used for recovery ↗" : "Commit evidence ↗"}
                      </button>
                      <Badge source={e.source} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="subtle">
            {rows.length} verified commits · latest step{" "}
            {Math.max(...rows.map((e) => e.step ?? 0))}{" "}
            <Badge source="derived" />
          </p>
        </>
      ) : (
        <p className="empty-state">No verified commit events in this replay.</p>
      )}
    </section>
  );
}
