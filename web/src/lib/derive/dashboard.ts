import type { Replay } from "../replay";
import { handoff } from "./handoff";

/** Beginner-facing copy is still derived solely from the verified projection. */
export function dashboardStory(replay: Replay | null) {
  const proof = replay?.recovery;
  const verified = proof?.verified_resumed === true;
  const injected = replay?.trigger?.source === "injected";
  return {
    verified,
    title: !replay
      ? "Every bit of work matters."
      : verified
        ? "The work kept going."
        : "The outcome is still unknown.",
    explanation: !replay
      ? "Open a saved run to see how LIFERAFT protects work when a worker needs to stop."
      : verified && proof.checkpoint && proof.resumed
        ? `Progress was saved at update ${proof.checkpoint.step}. The backup picked up at update ${proof.resumed.step}${proof.completed_after_resume ? " and finished the job" : ""}.`
        : "A recovery is only confirmed after the backup does a real piece of work. This record does not prove that yet.",
    lost: proof?.rpo_steps ?? null,
    seconds: proof?.rto_ms != null ? (proof.rto_ms / 1000).toFixed(2) : null,
    incidentTitle: !replay?.trigger
      ? "No trigger recorded."
      : injected
        ? "A practice alarm. A real handoff."
        : "A recorded incident.",
    incidentExplanation: !replay?.trigger
      ? "There is no alarm event in this saved record."
      : injected
        ? verified
          ? "The alarm was a labelled test, not real overheating. The saved work and restart are real."
          : "The alarm was a labelled test, not real overheating. This record does not yet prove that the backup continued."
        : `The trigger is labelled ${replay.trigger.source}. Open its record to understand what was actually observed.`,
    context: !replay
      ? "No saved run selected"
      : replay.mode === "local"
        ? "Two worker processes · one computer"
        : "Saved coordinator record · device identity not attested",
    next: handoff(replay).next,
    completed: proof?.completed_after_resume === true && verified,
    finalStep: replay?.progress?.step ?? null,
  };
}
