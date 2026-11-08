"use client";
import type { Replay } from "../../lib/replay";
import { topologyFrame } from "../../lib/derive/topology-frame";
import { lossSegments } from "../../lib/derive/loss";

export function RouteGraphic({
  replay,
  cursor,
}: {
  replay: Replay | null;
  cursor: number;
}) {
  const frame = topologyFrame(replay, cursor);
  const first = frame.nodes.find((n) => n.id === "primary")!,
    backup = frame.nodes.find((n) => n.id === "standby")!;
  return (
    <svg
      className="route-graphic"
      viewBox="0 0 560 202"
      role="img"
      aria-label={`Work transfer as of the replay cursor. First worker ${first.active ? "owns the work" : first.seen ? "recorded" : "not yet recorded"}. Backup ${backup.active ? "owns the work" : backup.seen ? "recorded" : "not yet recorded"}.`}
    >
      <g fill="none" stroke="currentColor" strokeWidth="1.2">
        <path
          className="route-path"
          d="M124 83H230M330 83H436"
          strokeDasharray={!replay ? "4 6" : undefined}
        />
        <path d="m217 78 7 5-7 5m202-10 7 5-7 5" />
        <path
          d="M280 118v33H174m106 0h106"
          strokeDasharray="3 6"
          className="route-secondary"
        />
      </g>
      <g
        transform="translate(34 39)"
        className={first.seen ? "" : "route-unseen"}
      >
        <path d="M9 0h72v49H9z" fill="var(--steel)" stroke="var(--frost)" />
        <path d="M18 8h54v32H18z" fill="var(--navy)" />
        <path d="m9 49-9 9h90l-9-9" fill="var(--frost)" />
        <path
          d="m30 22 9 8 19-16"
          fill="none"
          stroke="var(--honey)"
          strokeWidth="2"
        />
        <text x="45" y="83" textAnchor="middle">
          First worker
        </text>
        <text className="route-note" x="45" y="101" textAnchor="middle">
          {first.active
            ? "owns the work"
            : first.seen
              ? "saved progress"
              : "not recorded yet"}
        </text>
      </g>
      <g transform="translate(230 39)">
        <path d="M0 15 50 0l50 15-50 17Z" fill="var(--frost)" />
        <path d="M0 15v47l50 18V32Z" fill="var(--steel)" />
        <path d="M50 32v48l50-18V15Z" fill="var(--honey)" />
        <path
          d="M14 35 36 42m-22 4 22 7"
          stroke="var(--honey)"
          strokeWidth="2"
        />
        <circle cx="73" cy="47" r="5" fill="var(--red)" />
        <text x="50" y="107" textAnchor="middle">
          Control desk
        </text>
        <text className="route-note" x="50" y="125" textAnchor="middle">
          checks the handoff
        </text>
      </g>
      <g
        transform="translate(436 39)"
        className={backup.seen ? "" : "route-unseen"}
      >
        <path
          d="M9 0h72v49H9z"
          fill={backup.active ? "var(--honey)" : "var(--steel)"}
          stroke="var(--frost)"
        />
        <path d="M18 8h54v32H18z" fill="var(--navy)" />
        <path d="m9 49-9 9h90l-9-9" fill="var(--frost)" />
        {backup.active && (
          <path
            d="m30 22 9 8 19-16"
            fill="none"
            stroke="var(--honey)"
            strokeWidth="2"
          />
        )}
        <text x="45" y="83" textAnchor="middle">
          Backup worker
        </text>
        <text className="route-note" x="45" y="101" textAnchor="middle">
          {backup.active
            ? "owns the work"
            : backup.seen
              ? "recorded"
              : "not recorded yet"}
        </text>
      </g>
      <g className="route-peripherals">
        <path d="M145 144h25v15h-25zM149 148h8v7h-8m11-8v9" />
        <text x="157" y="178" textAnchor="middle">
          Pi · no data
        </text>
        <path d="M389 144h25v15h-25zM394 148h8v7h-8m11-12v6" />
        <text x="402" y="178" textAnchor="middle">
          ESP32 ·{" "}
          {frame.nodes.find((n) => n.id === "esp32")?.seen
            ? "recorded"
            : "no data"}
        </text>
      </g>
    </svg>
  );
}
export function ProgressGraphic({ replay }: { replay: Replay | null }) {
  const samples = replay?.losses ?? [];
  const maxStep = Math.max(1, ...samples.map((s) => s.step)),
    maxLoss = Math.max(0.001, ...samples.map((s) => s.loss));
  const x = (step: number) => 8 + (step / maxStep) * 484,
    y = (loss: number) => 91 - (loss / maxLoss) * 72;
  return (
    <svg
      className="progress-graphic"
      viewBox="0 0 500 110"
      role="img"
      aria-label={
        samples.length
          ? `${samples.length} measured training loss samples. Lower means less prediction error.`
          : "No measured training samples."
      }
    >
      {[24, 58, 92].map((y) => (
        <path key={y} d={`M8 ${y}H492`} className="progress-rule" />
      ))}
      {lossSegments(samples).map((segment, i) => (
        <path
          key={i}
          d={segment
            .map((s, j) => `${j ? "L" : "M"}${x(s.step)},${y(s.loss)}`)
            .join(" ")}
          fill="none"
          stroke={segment[0].epoch === 1 ? "var(--navy)" : "var(--steel)"}
          strokeWidth="2.4"
        />
      ))}
      {samples.length === 1 && (
        <circle
          cx={x(samples[0].step)}
          cy={y(samples[0].loss)}
          r="5"
          fill="var(--navy)"
        />
      )}
      {!!samples.length && (
        <>
          <text x="8" y="107">
            START
          </text>
          <text x="492" y="107" textAnchor="end">
            LATEST RECORDED UPDATE
          </text>
        </>
      )}
      {!samples.length && (
        <text x="250" y="60" textAnchor="middle">
          No measured samples
        </text>
      )}
    </svg>
  );
}
