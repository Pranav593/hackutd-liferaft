import type { Replay } from "../replay";
export function epochs(r: Replay | null) {
  const lanes = new Map<
    number,
    {
      epoch: number;
      worker: string;
      first: number;
      last: number;
      start: string;
      end: string;
      checkpoints: number;
      reason: string;
      eventId: string;
      seq: number;
    }
  >();
  for (const e of r?.events ?? []) {
    if (!e.worker || e.epoch < 1) continue;
    let lane = lanes.get(e.epoch);
    if (!lane) {
      lane = {
        epoch: e.epoch,
        worker: e.worker,
        first: e.step ?? 0,
        last: e.step ?? 0,
        start: e.at,
        end: e.at,
        checkpoints: 0,
        reason: "open",
        eventId: e.id,
        seq: e.seq,
      };
      lanes.set(e.epoch, lane);
    }
    if (e.step != null) {
      lane.first = Math.min(lane.first, e.step);
      lane.last = Math.max(lane.last, e.step);
    }
    lane.end = e.at;
    if (e.kind === "CHECKPOINT_COMMITTED") lane.checkpoints++;
    if (
      /PRIMARY_YIELDED|PRIMARY_UNREACHABLE|PRIMARY_PROCESS_KILLED|JOB_COMPLETED/.test(
        e.kind,
      )
    )
      lane.reason = e.kind;
  }
  for (const s of r?.losses ?? []) {
    const lane = lanes.get(s.epoch);
    if (lane) {
      lane.first = Math.min(lane.first, s.step);
      lane.last = Math.max(lane.last, s.step);
    }
  }
  return [...lanes.values()].sort((a, b) => a.epoch - b.epoch);
}
