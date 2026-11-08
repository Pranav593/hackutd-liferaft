"use client";
import {
  useCockpit,
  update,
  step,
  setCursor,
} from "../../lib/store/cockpit-store";
import { eventName, utc } from "../../lib/replay";
import { matches, milestones } from "../../lib/derive/timeline";
export function ReplayScrubber() {
  const r = useCockpit((s) => s.replay),
    c = useCockpit((s) => s.cursor),
    playing = useCockpit((s) => s.playing),
    speed = useCockpit((s) => s.speed),
    filters = useCockpit((s) => s.filters);
  const e = r?.events[c],
    n = r?.events.length ?? 0;
  return (
    <nav
      className="scrubber"
      aria-label="Replay transport"
      onKeyDown={(event) => {
        if (
          event.target instanceof HTMLElement &&
          ["INPUT", "SELECT"].includes(event.target.tagName)
        )
          return;
        if (event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          if (c === n - 1) setCursor(0);
          update({ playing: !playing });
        } else if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          event.stopPropagation();
          setCursor(event.key === "Home" ? 0 : n - 1);
        }
      }}
    >
      <div className="scrubber-controls">
        <button
          disabled={!n}
          aria-label="First event"
          onClick={() => setCursor(0)}
        >
          ⏮
        </button>
        <button
          disabled={!n || c === 0}
          aria-label="Previous event"
          onClick={() => step(-1)}
        >
          ←
        </button>
        <button
          disabled={!n}
          aria-label={playing ? "Pause replay" : "Play replay"}
          aria-pressed={playing}
          onClick={() => {
            if (c === n - 1) setCursor(0);
            update({ playing: !playing });
          }}
        >
          {playing ? "Ⅱ" : "▶"}
        </button>
        <button
          disabled={!n || c === n - 1}
          aria-label="Next event"
          onClick={() => step(1)}
        >
          →
        </button>
        <button
          disabled={!n}
          aria-label="Last event"
          onClick={() => setCursor(n - 1)}
        >
          ⏭
        </button>
        <label className="sr-only" htmlFor="speed">
          Playback speed
        </label>
        <select
          id="speed"
          value={speed}
          onChange={(e) => update({ speed: Number(e.target.value) })}
        >
          {[0.5, 1, 2].map((s) => (
            <option key={s} value={s}>
              {s}×
            </option>
          ))}
        </select>
      </div>
      <div className="scrubber-track">
        <input
          aria-label="Replay event"
          type="range"
          min={0}
          max={Math.max(0, n - 1)}
          value={Math.max(0, c)}
          disabled={!n}
          aria-valuetext={
            e
              ? `Event ${c + 1} of ${n}: ${eventName(e.kind)}, ${utc(e.at)}`
              : "No saved events"
          }
          onChange={(e) => setCursor(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === " ") {
              e.preventDefault();
              update({ playing: !playing });
            }
            if (e.shiftKey && ["ArrowLeft", "ArrowRight"].includes(e.key)) {
              e.preventDefault();
              step(e.key === "ArrowLeft" ? -1 : 1, true);
            }
          }}
        />
        <div className="scrubber-ticks" aria-hidden="true">
          {r?.events.map((row) => (
            <i
              key={row.id}
              className={`${milestones.has(row.kind) ? "milestone" : ""} ${row.source} ${matches(row, filters) ? "" : "filtered"}`}
              title={`${eventName(row.kind)} · ${row.source} · ${utc(row.at)}`}
            />
          ))}
        </div>
      </div>
      <span className="scrubber-caption">
        {e ? `${c + 1}/${n} · ${utc(e.at)}` : "NO JOURNAL"}
        <small>{e ? eventName(e.kind) : "Read-only replay"}</small>
      </span>
    </nav>
  );
}
