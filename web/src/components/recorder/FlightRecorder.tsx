"use client";
import { memo, useMemo, useState } from "react";
import type { ReplayEvent } from "../../lib/replay";
import { eventName, utc } from "../../lib/replay";
import { useCockpit, update, select } from "../../lib/store/cockpit-store";
import { useRelated, trace } from "../../lib/store/hover-store";
import { matches, defaultFilters } from "../../lib/derive/timeline";
import { relationIndex } from "../ui/EvidenceTrace";
import { Badge, PanelTitle } from "../ui";
const EventRow = memo(function EventRow({
  e,
  chosen,
  future,
  related,
}: {
  e: ReplayEvent;
  chosen: boolean;
  future: boolean;
  related: ReadonlySet<string>;
}) {
  const bright = useRelated(e.id);
  return (
    <li className={`${bright ? "" : "unrelated"} ${future ? "future" : ""}`}>
      <button
        className="event-row"
        aria-pressed={chosen}
        aria-current={chosen ? "true" : undefined}
        onClick={() => select(e.id)}
        onMouseEnter={() => trace(related)}
        onMouseLeave={() => trace(null)}
        onFocus={() => trace(related)}
        onBlur={() => trace(null)}
      >
        <span className="event-seq">{String(e.seq).padStart(2, "0")}</span>
        <span className="event-label">
          <strong>{eventName(e.kind)}</strong>
          <time dateTime={e.at}>{utc(e.at)}</time>
        </span>
        <Badge source={e.source} />
        <span aria-hidden="true">↗</span>
      </button>
    </li>
  );
});
export function FlightRecorder() {
  const r = useCockpit((s) => s.replay),
    selected = useCockpit((s) => s.selectedId),
    cursor = useCockpit((s) => s.cursor),
    filters = useCockpit((s) => s.filters);
  const [page, setPage] = useState(0);
  const index = useMemo(() => relationIndex(r) ?? new Map(), [r]);
  const rows = useMemo(
    () =>
      r?.events.filter((e) => e.id === selected || matches(e, filters)) ?? [],
    [r, selected, filters],
  );
  const patch = (p: Partial<typeof filters>) => {
    update({ filters: { ...filters, ...p } });
    setPage(0);
  };
  const pages = Math.ceil(rows.length / 200),
    offset = Math.min(page, Math.max(0, pages - 1)) * 200;
  let visible = rows.slice(offset, offset + 200);
  const chosen = rows.find((e) => e.id === selected);
  if (chosen && !visible.includes(chosen))
    visible = [...visible, chosen].sort((a, b) => a.seq - b.seq);
  return (
    <section
      className="panel recorder-panel"
      id="recorder"
      aria-label="Flight recorder"
    >
      <PanelTitle
        icon="clock"
        title="Flight recorder"
        detail={<Badge source={r ? "derived" : "no data"} />}
      />
      <p className="chain-line">
        {r ? (
          <>
            <span className="verified">✓ Chain verified</span>
            <span className={r.journal.anchored ? "" : "warning"}>
              {r.journal.anchored
                ? "Export head verified"
                : "Unanchored export (legacy)"}
            </span>
            <code>{r.journal.head.slice(0, 12)}</code>
          </>
        ) : (
          "Open a saved journal to inspect its event chain."
        )}
      </p>
      <div className="recorder-toolbar">
        <div className="segmented" aria-label="Event scope">
          {(["milestones", "all"] as const).map((scope) => (
            <button
              key={scope}
              aria-pressed={filters.scope === scope}
              onClick={() => patch({ scope })}
            >
              {scope === "all" ? "All events" : "Milestones"}
            </button>
          ))}
        </div>
        <small title="Filters change this list and scrubber ticks only; the full replay remains unchanged.">
          {rows.length} of {r?.events.length ?? 0}{" "}
          <Badge source={r ? "derived" : "no data"} />
        </small>
      </div>
      <div className="filters">
        <label className="search-field">
          <span className="sr-only">Search events</span>
          <input
            id="event-search"
            placeholder="Search id, worker, hash, step…"
            value={filters.query}
            onChange={(e) => patch({ query: e.target.value })}
          />
        </label>
        {(
          [
            [
              "group",
              ["Lifecycle", "Checkpoint", "Ownership", "Sensor", "Provider"],
            ],
            [
              "source",
              ["measured", "injected", "derived", "provider", "simulated"],
            ],
            [
              "worker",
              [
                ...new Set(
                  r?.events
                    .map((e) => e.worker)
                    .filter((s): s is string => !!s),
                ),
              ],
            ],
            ["epoch", [...new Set(r?.events.map((e) => String(e.epoch)))]],
            ["severity", ["INFO", "WARNING", "ERROR"]],
          ] as [keyof Omit<typeof filters, "scope" | "query">, string[]][]
        ).map(([key, options]) => (
          <label key={key}>
            <span className="sr-only">Filter {key}</span>
            <select
              aria-label={`Filter ${key}`}
              value={filters[key]}
              onChange={(e) => patch({ [key]: e.target.value })}
            >
              <option value="">Any {key}</option>
              {options.map((option) => (
                <option key={option}>{option}</option>
              ))}
            </select>
          </label>
        ))}
        <button
          className="text-button"
          onClick={() => {
            update({ filters: defaultFilters });
            setPage(0);
          }}
        >
          Clear
        </button>
      </div>
      <div className="active-filters">
        {Object.entries(filters)
          .filter(([k, v]) => k !== "scope" && v)
          .map(([k, v]) => (
            <button
              className="filter-chip"
              key={k}
              aria-label={`Remove ${k} filter`}
              onClick={() => patch({ [k]: "" })}
            >
              {k}: {v} ×
            </button>
          ))}
      </div>
      {visible.length ? (
        <ol className="event-list" aria-label="Recorded events">
          {visible.map((e) => (
            <EventRow
              key={e.id}
              e={e}
              chosen={e.id === selected}
              future={e.seq > (r?.events[cursor]?.seq ?? 0)}
              related={index.get(e.id)?.eventIds ?? new Set([e.id])}
            />
          ))}
        </ol>
      ) : (
        <p className="empty-state">
          {r
            ? "No matching events. Clear filters to see the journal."
            : "No events to display."}
        </p>
      )}
      {pages > 1 && (
        <nav aria-label="Event pages">
          <button disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous page
          </button>
          <span>
            {page + 1} / {pages}
          </span>
          <button
            disabled={page >= pages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            Next page
          </button>
        </nav>
      )}
    </section>
  );
}
