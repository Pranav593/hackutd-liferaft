import type { Replay } from "../replay";
export function ledger(r: Replay | null, ascending = false) {
  return (r?.events ?? [])
    .filter((e) => e.kind === "CHECKPOINT_COMMITTED" && e.hash_prefix)
    .map((e) => ({
      ...e,
      used: e.checkpoint_id === r?.recovery.checkpoint?.checkpoint_id,
    }))
    .sort((a, b) => ((a.step ?? 0) - (b.step ?? 0)) * (ascending ? 1 : -1));
}
