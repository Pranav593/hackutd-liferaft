"use client";

import type { Derived } from "../../lib/mission";

type Tone = "ok" | "warn" | "bad" | "idle" | "info";
type Node = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  sub: string;
  status: string;
  tone: Tone;
};

export function FleetMap({
  d,
  agentActive,
  notified,
  buttonDrill,
  simulated,
}: {
  d: Derived;
  agentActive: boolean;
  notified: boolean;
  buttonDrill: boolean;
  simulated: boolean;
}) {
  const retired = d.handedOff;
  const nodes: Node[] = [
    {
      id: "sensor",
      x: 115,
      y: 280,
      w: 150,
      h: 64,
      title: "ESP32 sensor",
      sub: buttonDrill ? "button + OLED" : "temperature feed",
      status: d.warned ? "ALARM" : "WATCHING",
      tone: d.warned ? "warn" : "ok",
    },
    {
      id: "primary",
      x: 115,
      y: 110,
      w: 170,
      h: 70,
      title: d.primary ?? "Primary",
      sub: simulated ? "primary · this laptop" : "primary · Raspberry Pi",
      status: retired ? "RETIRED · fenced" : d.warned ? "AT RISK" : d.primary ? "TRAINING" : "IDLE",
      tone: retired ? "bad" : d.warned ? "warn" : d.primary ? "ok" : "idle",
    },
    {
      id: "coord",
      x: 360,
      y: 180,
      w: 170,
      h: 78,
      title: "Coordinator",
      sub: "ledger · leases · policy",
      status: `epoch ${d.epoch}`,
      tone: "info",
    },
    {
      id: "standby",
      x: 605,
      y: 110,
      w: 170,
      h: 70,
      title: d.standby ?? "Standby",
      sub: simulated ? "standby · this laptop" : "standby · Windows laptop",
      status: d.handedOff ? (d.resumed ? "TRAINING" : "LOADING") : "READY",
      tone: d.handedOff ? "ok" : "info",
    },
    {
      id: "agent",
      x: 360,
      y: 305,
      w: 150,
      h: 64,
      title: "AI ops agent",
      sub: "read-only tools",
      status: agentActive ? "ADVISING" : "STANDING BY",
      tone: agentActive ? "info" : "idle",
    },
    {
      id: "oncall",
      x: 605,
      y: 280,
      w: 150,
      h: 64,
      title: "On-call engineer",
      sub: "message + brief",
      status: notified ? "NOTIFIED" : "QUIET",
      tone: notified ? "ok" : "idle",
    },
  ];
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const links: [string, string, boolean][] = [
    ["sensor", "primary", d.warned],
    ["primary", "coord", !d.handedOff && !!d.primary],
    ["coord", "standby", d.handedOff],
    ["coord", "agent", agentActive],
    ["coord", "oncall", notified],
  ];
  const ownerNode = d.handedOff ? by.standby : by.primary;
  return (
    <svg viewBox="0 0 720 360" className="fleet" role="img" aria-label="Fleet map showing which machine currently owns the training job">
      <defs>
        <pattern id="fleet-dots" width="18" height="18" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" className="grid-dot" />
        </pattern>
      </defs>
      <rect width="720" height="360" fill="url(#fleet-dots)" />
      {links.map(([a, b, live]) => {
        const path = `M${by[a].x},${by[a].y} L${by[b].x},${by[b].y}`;
        return (
          <g key={a + b}>
            <path d={path} className={live ? "edge live" : "edge"} />
            {live && (
              <circle r={3.2} className="packet">
                <animateMotion dur="1.6s" repeatCount="indefinite" path={path} />
              </circle>
            )}
          </g>
        );
      })}
      {nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x - n.w / 2},${n.y - n.h / 2})`} className={`node ${n.tone}`}>
          <rect width={n.w} height={n.h} rx={14} />
          <circle cx={n.w - 16} cy={17} r={4} className="n-dot" />
          <text x={14} y={24} className="n-title">
            {n.title.length > 18 ? n.title.slice(0, 17) + "…" : n.title}
          </text>
          <text x={14} y={40} className="n-sub">
            {n.sub}
          </text>
          <text x={14} y={n.h - 12} className="n-status">
            {n.status}
          </text>
        </g>
      ))}
      <g className="baton" style={{ transform: `translate(${ownerNode.x}px, ${ownerNode.y - ownerNode.h / 2 - 16}px)` }}>
        <circle r={16} className="baton-ring" />
        <circle r={7} className="baton-core" />
      </g>
      <text x={360} y={30} textAnchor="middle" className="map-caption">
        {d.handedOff ? "The baton moved. Training did not." : "The orange marker is the machine that owns the training job"}
      </text>
    </svg>
  );
}
