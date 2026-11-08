import type { Replay, ReplayEvent } from "../replay";

export const milestones = new Set([
  "JOB_STARTED",
  "SENSOR_EVENT_RECEIVED",
  "RESCUE_REQUESTED",
  "PRIMARY_PROCESS_KILLED",
  "PRIMARY_UNREACHABLE",
  "PRIMARY_PAUSE_REQUESTED",
  "PRIMARY_YIELDED",
  "CHECKPOINT_SELECTED",
  "LEASE_TRANSFERRED",
  "FIRST_RESUMED_STEP_COMPLETED",
  "JOB_COMPLETED",
]);
export type Filters = {
  scope: "milestones" | "all";
  group: string;
  source: string;
  worker: string;
  epoch: string;
  severity: string;
  query: string;
};
export const defaultFilters: Filters = {
  scope: "milestones",
  group: "",
  source: "",
  worker: "",
  epoch: "",
  severity: "",
  query: "",
};
export function kindGroup(e: ReplayEvent) {
  if (e.source === "provider") return "Provider";
  if (/^CHECKPOINT_/.test(e.kind)) return "Checkpoint";
  if (/^(LEASE_|PRIMARY_|FIRST_RESUMED_)/.test(e.kind)) return "Ownership";
  if (/^(SENSOR_|COOLING_|WORKER_HEARTBEAT)/.test(e.kind)) return "Sensor";
  return "Lifecycle";
}
export function severity(e: ReplayEvent) {
  return /KILLED|UNREACHABLE/.test(e.kind)
    ? "ERROR"
    : /RESCUE_REQUESTED|SENSOR_|PAUSE/.test(e.kind)
      ? "WARNING"
      : "INFO";
}
export function matches(e: ReplayEvent, f: Filters) {
  return (
    (f.scope === "all" || milestones.has(e.kind)) &&
    (!f.group || kindGroup(e) === f.group) &&
    (!f.source || e.source === f.source) &&
    (!f.worker || e.worker === f.worker) &&
    (!f.epoch || String(e.epoch) === f.epoch) &&
    (!f.severity || severity(e) === f.severity) &&
    `${e.id} ${e.kind} ${e.worker ?? ""} ${e.hash_prefix ?? ""} ${e.step ?? ""}`
      .toLowerCase()
      .includes(f.query.toLowerCase())
  );
}
export function beats(r: Replay | null) {
  const evidence =
    r?.events.filter((e) => r.recovery.evidence_event_ids.includes(e.id)) ?? [];
  return [
    r?.trigger,
    evidence.find((e) => e.kind === "CHECKPOINT_COMMITTED") ??
      r?.events.find(
        (e) =>
          e.checkpoint_id === r.recovery.checkpoint?.checkpoint_id &&
          e.kind === "CHECKPOINT_COMMITTED",
      ),
    evidence.find((e) => e.kind === "LEASE_TRANSFERRED"),
    evidence.find((e) => e.kind === "FIRST_RESUMED_STEP_COMPLETED"),
  ].map((e) => e ?? null);
}
