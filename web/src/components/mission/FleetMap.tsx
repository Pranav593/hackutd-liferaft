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
      y: 255,
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
      y: 95,
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
      y: 160,
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
      y: 95,
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
      y: 290,
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
      y: 255,
      w: 150,
      h: 64,
      title: "On-call engineer",
      sub: "message + brief",
      status: notified ? "NOTIFIED" : "QUIET",
      tone: notified ? "ok" : "idle",
    },
  ];
  const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
  const edge = (a: string, b: string, live: boolean, key: string) => (
    <line
      key={key}
      x1={by[a].x}
      y1={by[a].y}
      x2={by[b].x}
      y2={by[b].y}
      className={live ? "edge live" : "edge"}
    />
  );
  const ownerNode = d.handedOff ? by.standby : by.primary;
  return (
    <svg viewBox="0 0 720 340" className="fleet" role="img" aria-label="Fleet map showing which machine currently owns the training job">
      {edge("sensor", "primary", d.warned, "e1")}
      {edge("primary", "coord", !d.handedOff && !!d.primary, "e2")}
      {edge("coord", "standby", d.handedOff, "e3")}
      {edge("coord", "agent", agentActive, "e4")}
      {edge("coord", "oncall", notified, "e5")}
      {nodes.map((n) => (
        <g key={n.id} transform={`translate(${n.x - n.w / 2},${n.y - n.h / 2})`} className={`node ${n.tone}`}>
          <rect width={n.w} height={n.h} rx={12} />
          <text x={12} y={22} className="n-title">
            {n.title.length > 20 ? n.title.slice(0, 19) + "…" : n.title}
          </text>
          <text x={12} y={38} className="n-sub">
            {n.sub}
          </text>
          <text x={12} y={n.h - 10} className="n-status">
            {n.status}
          </text>
        </g>
      ))}
      <g
        className="baton"
        style={{ transform: `translate(${ownerNode.x + ownerNode.w / 2 - 14}px, ${ownerNode.y - ownerNode.h / 2 - 2}px)` }}
      >
        <circle r={11} />
        <text textAnchor="middle" y={4}>
          ⚡
        </text>
      </g>
      <text x={360} y={26} textAnchor="middle" className="map-caption">
        {d.handedOff ? "The baton (⚡) moved. Training did not." : "⚡ marks the machine that owns the training job"}
      </text>
    </svg>
  );
}
