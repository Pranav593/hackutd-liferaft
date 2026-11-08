export type StoryEvent = {
  seq: number;
  event_id: string;
  event_type: string;
  created_utc: string;
  source_type: string;
  lease_epoch: number;
  worker_id: string | null;
  event_hash: string;
  prev_hash: string;
  evidence: Record<string, unknown>;
};

export type StoryData = {
  scenario: string;
  chain_valid: boolean;
  events: StoryEvent[];
  status: {
    rpo_steps: number | null;
    rto_ms: number | null;
    resume_step: number;
    epoch: number;
  };
  proof: {
    baseline: number[];
    recovered: number[];
    max_divergence: number;
    weights_equal: boolean;
    compared_steps: number;
    sha256: string;
  };
};

export const scenarios = [
  {
    id: "cooling",
    icon: "↗",
    title: "Cooling fault",
    detail: "Predict → evacuate",
  },
  { id: "crash", icon: "ϟ", title: "Hard crash", detail: "Expire → recover" },
  {
    id: "corrupt",
    icon: "◇",
    title: "Corrupt checkpoint",
    detail: "Reject → fall back",
  },
  {
    id: "zombie",
    icon: "⊘",
    title: "Zombie primary",
    detail: "Fence → refuse",
  },
];

export function caption(event?: StoryEvent): string {
  switch (event?.event_type) {
    case "REHEARSAL_TELEMETRY":
      return "A cooling fault begins. Injected signal. Real training.";
    case "FAILURE_FORECAST":
      return event.evidence.eligible
        ? "The warning arrives before the worker stops."
        : "Building a trend. One hot reading is not enough.";
    case "REHEARSAL_TOOL_RESULT":
      return "Inspect the evidence. Explain the plan. Keep authority in code.";
    case "RESCUE_REQUESTED":
      return "Evacuate while the primary is still alive.";
    case "PRIMARY_PAUSE_REQUESTED":
      return "Drain cleanly. Save model, optimizer, cursor and RNG.";
    case "PRIMARY_YIELDED":
      return "The old owner yields only after a verified checkpoint.";
    case "LEASE_TRANSFERRED":
      return "Epoch 2. A new owner. The old primary is fenced out.";
    case "FIRST_RESUMED_STEP_COMPLETED":
      return "The next optimizer update is real. Training continues.";
    case "CHECKPOINT_REJECTED":
      return "Corruption detected. Reject these bytes; find a good checkpoint.";
    case "PRIMARY_PROCESS_KILLED":
      return "The training process stops. The finite lease is still enforced.";
    case "STALE_LEASE_REJECTED":
      return "The zombie tries to write. The epoch fence says no.";
    case "JOB_COMPLETED":
      return "100 real updates complete. Now compare with the ghost run.";
    case "REHEARSAL_MESSAGE":
      return "Leave the next engineer a brief, not a mystery.";
    default:
      return "Watch the machine. Protect the work. Prove the handoff.";
  }
}
