import type { Replay } from "../replay";
export function narrative(r: Replay | null) {
  if (!r)
    return {
      title: "No saved evidence selected.",
      detail: "Set LIFERAFT_COCKPIT_JOB and restart the console.",
      verified: false,
    };
  const p = r.recovery;
  if (!p.verified_resumed || !p.resumed || !p.checkpoint)
    return {
      title: "Recovery not verified in this evidence.",
      detail:
        p.unknowns[0] ??
        "No verified first optimizer step on a new owner is recorded.",
      verified: false,
    };
  return {
    title: "Training survived.",
    detail: `The standby resumed at step ${p.resumed.step} from a verified step ${p.checkpoint.step} checkpoint${p.rto_ms != null ? ` in ${(p.rto_ms / 1000).toFixed(3)} s` : ""}, with ${p.rpo_steps != null ? `${p.rpo_steps} known steps lost` : "work lost: unknown"}.${p.completed_after_resume && r.progress?.step != null ? ` Training then completed at step ${r.progress.step}.` : ""}`,
    verified: true,
  };
}
