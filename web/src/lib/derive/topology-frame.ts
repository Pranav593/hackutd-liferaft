import type { Replay, ReplayEvent } from "../replay";
import { utc } from "../replay";
export type NodeId = "coordinator" | "primary" | "standby" | "pi" | "esp32";
export const positions: Record<NodeId, [number, number, number]> = {
  coordinator: [0, 0.2, 0],
  primary: [-3.2, 0.2, -1.6],
  standby: [3.2, 0.2, -1.6],
  pi: [-3, -0.1, 2],
  esp32: [3, -0.1, 2],
};
export type NodeState = {
  id: NodeId;
  label: string;
  detail: string;
  source: ReplayEvent["source"] | "no data";
  seen: boolean;
  eventId: string | null;
  active: boolean;
};
export type Transition = {
  kind: "packet" | "baton" | "halo" | "signal";
  from: NodeId;
  to: NodeId;
  text: string;
  source: ReplayEvent["source"];
  eventId: string;
};
export type TopologyFrame = {
  nodes: NodeState[];
  epoch: number | null;
  checkpointCount: number;
  transition: Transition | null;
  cursorId: string | null;
};
export function topologyFrame(
  r: Replay | null,
  cursor: number,
  previous = -2,
): TopologyFrame {
  const all = r?.events ?? [],
    past = all.slice(0, cursor + 1),
    current = past.at(-1);
  const primary =
    all.find((e) => e.kind === "JOB_STARTED")?.worker ??
    r?.recovery.checkpoint?.producer;
  const standby = all.findLast((e) => e.kind === "LEASE_TRANSFERRED")?.worker;
  const primaryEvents = past.filter((e) => !!primary && e.worker === primary),
    standbyEvents = past.filter((e) => !!standby && e.worker === standby);
  const owner = past.findLast(
    (e) => e.kind === "LEASE_TRANSFERRED" || e.kind === "JOB_STARTED",
  );
  const sensor = past.findLast((e) => e.sensor);
  const commits = past.filter((e) => e.kind === "CHECKPOINT_COMMITTED");
  const lastPrimary = primaryEvents.at(-1),
    lastStandby = standbyEvents.at(-1);
  const node = (
    id: NodeId,
    label: string,
    detail: string,
    e: ReplayEvent | undefined,
    active = false,
  ): NodeState => ({
    id,
    label,
    detail,
    source: e?.source ?? "no data",
    seen: !!e,
    eventId: e?.id ?? null,
    active,
  });
  const nodes = [
    node(
      "coordinator",
      "Coordinator",
      r
        ? `${r.mode} · epoch ${owner?.epoch ?? "unknown"} · ${commits.length} commits · head ${current?.hash ?? "unknown"}`
        : "No saved journal",
      current,
    ),
    node(
      "primary",
      primary ?? "First owner",
      lastPrimary
        ? `${primary} · ${lastPrimary.kind} · last recorded step ${primaryEvents.findLast((e) => e.step != null)?.step ?? "unknown"} · epoch ${lastPrimary.epoch}`
        : "Not seen as of cursor",
      lastPrimary,
      !!primary &&
        owner?.worker === primary &&
        !past.some((e) => e.worker === primary && e.kind === "PRIMARY_YIELDED"),
    ),
    node(
      "standby",
      standby ?? "Standby",
      lastStandby
        ? `${standby} · ${lastStandby.kind} · step ${lastStandby.step ?? "unknown"} · epoch ${lastStandby.epoch}${lastStandby.loss != null ? ` · loss ${lastStandby.loss}` : ""}`
        : "Not yet claimed as of cursor",
      lastStandby,
      !!standby && owner?.worker === standby,
    ),
    node(
      "pi",
      "Raspberry Pi",
      "No CPU sample in this projection. Compute role is not attested.",
      undefined,
    ),
    node(
      "esp32",
      "ESP32 gateway",
      sensor
        ? `${sensor.sensor?.device} · ${utc(sensor.at)} · ambient ${sensor.sensor?.ambient ?? "NO DATA"} · via USB serial bridge laptop`
        : "No sensor frame as of cursor · via USB serial bridge laptop",
      sensor,
    ),
  ];
  let transition: Transition | null = null;
  if (current && cursor === previous + 1) {
    const e = current,
      from: NodeId =
        e.worker === primary
          ? "primary"
          : e.worker === standby
            ? "standby"
            : "coordinator";
    const make = (
      kind: Transition["kind"],
      a: NodeId,
      b: NodeId,
      text: string,
    ) => ({ kind, from: a, to: b, text, source: e.source, eventId: e.id });
    if (e.kind === "SENSOR_EVENT_RECEIVED" && e.sensor)
      transition = make(
        "packet",
        "esp32",
        "coordinator",
        `Button · ${e.source}`,
      );
    else if (
      e.kind === "CHECKPOINT_COMMITTED" &&
      e.worker &&
      from !== "coordinator" &&
      e.step != null &&
      e.hash_prefix
    )
      transition = make(
        "packet",
        from,
        "coordinator",
        `Step ${e.step} · sha ${e.hash_prefix}`,
      );
    else if (
      e.kind === "LEASE_TRANSFERRED" &&
      primary &&
      standby &&
      e.worker === standby
    )
      transition = make(
        "baton",
        "primary",
        "standby",
        `Ownership → epoch ${e.epoch}`,
      );
    else if (e.kind === "PRIMARY_PAUSE_REQUESTED" && primary)
      transition = make(
        "signal",
        "coordinator",
        "primary",
        "Primary pause requested",
      );
    else if (e.kind === "PRIMARY_YIELDED" && primary)
      transition = make(
        "baton",
        "primary",
        "coordinator",
        "Primary yielded lease",
      );
    else if (
      e.kind === "FIRST_RESUMED_STEP_COMPLETED" &&
      e.step != null &&
      e.loss != null &&
      e.worker === standby
    )
      transition = make(
        "halo",
        "standby",
        "standby",
        `Step ${e.step} · loss ${e.loss}`,
      );
    else if (
      ["RESCUE_REQUESTED", "CHECKPOINT_SELECTED", "RESCUE_VERIFIED"].includes(
        e.kind,
      )
    )
      transition = make(
        "halo",
        "coordinator",
        "coordinator",
        e.kind === "RESCUE_VERIFIED"
          ? "Coordinator recovery record"
          : e.kind.toLowerCase().replaceAll("_", " "),
      );
    else if (e.kind === "JOB_STARTED" && e.worker)
      transition = make(
        "halo",
        "primary",
        "coordinator",
        `Ownership epoch ${e.epoch}`,
      );
  }
  return {
    nodes,
    epoch: owner?.epoch ?? null,
    checkpointCount: commits.length,
    transition,
    cursorId: current?.id ?? null,
  };
}
