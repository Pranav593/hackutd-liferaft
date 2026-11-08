import type { Replay } from "../replay";
import { utc } from "../replay";
export function handoff(r: Replay | null) {
  if (!r)
    return {
      happened: "No saved evidence selected.",
      verified: "No recovery proof available.",
      unknown: ["No journal attached."],
      next: "Select saved evidence and re-verify its journal.",
    };
  const p = r.recovery;
  const happened = r.trigger
    ? `A ${r.trigger.source === "injected" ? "labelled cooling drill (injected)" : `${r.trigger.source} incident`} was recorded at ${utc(r.trigger.at)}.`
    : "No trigger is recorded.";
  const verified =
    p.verified_resumed && p.checkpoint && p.resumed
      ? `Checkpoint ${p.checkpoint.step} (sha ${p.checkpoint.hash_prefix}) → ${p.resumed.worker_id} claimed epoch ${p.resumed.epoch} → first step ${p.resumed.step} measured.${p.completed_after_resume ? ` Training completed at step ${r.progress?.step ?? "unknown"}.` : ""} Chain verified (${r.journal.anchored ? "anchored export" : "legacy, no export anchor"}).`
      : "Recovery not verified in this evidence.";
  const next = !p.verified_resumed
    ? "Do not treat as recovered. Inspect the standby worker's log and the last committed checkpoint."
    : r.trigger?.source === "injected"
      ? "No physical fault is claimed. Confirm drill closure and archive the journal."
      : r.trigger?.source === "measured"
        ? "Review the triggering sensor reading and the primary host before returning it to service."
        : "Review the trigger provenance and archive the journal.";
  // Bound free-form unknowns; the full limits remain visible in Recovery Proof.
  const budget = Math.max(
    0,
    112 - `${happened} ${verified} ${next}`.split(/\s+/).length,
  );
  const unknown = (p.unknowns.join(" ") || "No additional unknowns recorded.")
    .split(/\s+/)
    .slice(0, budget)
    .join(" ");
  return {
    happened,
    verified,
    unknown: [unknown || "See verification limits."],
    next,
  };
}
