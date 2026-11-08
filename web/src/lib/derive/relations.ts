import type { Replay } from "../replay";
import type { NodeId } from "./topology-frame";
export function relations(r: Replay) {
  const primary =
    r.events.find((e) => e.kind === "JOB_STARTED")?.worker ??
    r.recovery.checkpoint?.producer;
  const standby = r.events.findLast(
    (e) => e.kind === "LEASE_TRANSFERRED",
  )?.worker;
  const checkpoints = new Map<string, string[]>();
  for (const event of r.events)
    if (event.checkpoint_id) {
      const list = checkpoints.get(event.checkpoint_id) ?? [];
      list.push(event.id);
      checkpoints.set(event.checkpoint_id, list);
    }
  const losses = new Set(
    r.losses.map((s) => `${s.worker}:${s.epoch}:${s.step}`),
  );
  const proofIds = new Set(r.recovery.evidence_event_ids);
  return new Map(
    r.events.map((e, i) => [
      e.id,
      {
        eventIds: new Set(
          [
            e.id,
            r.events[i - 1]?.id,
            r.events[i + 1]?.id,
            ...(e.checkpoint_id
              ? (checkpoints.get(e.checkpoint_id) ?? [])
              : []),
            ...(proofIds.has(e.id) ? r.recovery.evidence_event_ids : []),
          ].filter((id): id is string => !!id),
        ),
        checkpointId: e.checkpoint_id,
        epoch: e.epoch,
        worker: e.worker,
        lossSteps:
          e.step !== null && losses.has(`${e.worker}:${e.epoch}:${e.step}`)
            ? [e.step]
            : [],
        node: [
          "coordinator",
          ...(e.worker && e.worker === primary
            ? ["primary"]
            : e.worker && e.worker === standby
              ? ["standby"]
              : []),
          ...(e.sensor ? ["esp32"] : []),
        ] as NodeId[],
        edge: e.sensor
          ? "esp32"
          : e.worker && e.worker === primary
            ? "primary"
            : e.worker && e.worker === standby
              ? "standby"
              : undefined,
      },
    ]),
  );
}
