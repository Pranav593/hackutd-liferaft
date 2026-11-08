import type { Source } from "./contracts"

export interface ReplayEvent {
  seq: number
  id: string
  incident: string | null
  kind: string
  source: Source
  at: string
  worker: string | null
  epoch: number
  step: number | null
  loss: number | null
  hash: string
  previous_hash: string
  sensor: { device: string; button: boolean; ambient: number | null } | null
  checkpoint_id?: string
  hash_prefix?: string
}

export interface LossSample {
  step: number
  loss: number
  at: string
  worker: string
  epoch: number
  origin: "worker log" | "journal"
}

export interface Replay {
  job: string
  mode: "local" | "cloud"
  journal: { count: number; head: string; at: string; anchored: boolean }
  recovery: {
    verified_resumed: boolean
    completed_after_resume: boolean
    checkpoint: { checkpoint_id: string; step: number; hash_prefix: string; producer: string; epoch: number } | null
    resumed: { worker_id: string; epoch: number; step: number; loss: number } | null
    rto_ms: number | null
    rpo_steps: number | null
    evidence_event_ids: string[]
    unknowns: string[]
  }
  events: ReplayEvent[]
  trigger: ReplayEvent | null
  progress: ReplayEvent | null
  losses: LossSample[]
  investigation_rejected: boolean
  investigation: {
    model: string
    tools: { name: string; event_ids: string[] }[]
    facts: { text: string; evidence_event_ids: string[] }[]
    uncertainty: string
    outcome: string
  } | null
}

const names: Record<string, string> = {
  JOB_STARTED: "Training started",
  SENSOR_EVENT_RECEIVED: "ESP32 button frame",
  RESCUE_REQUESTED: "Cooling drill requested",
  PRIMARY_PAUSE_REQUESTED: "Primary pause requested",
  PRIMARY_YIELDED: "Primary yielded lease",
  CHECKPOINT_COMMITTED: "Checkpoint committed",
  CHECKPOINT_SELECTED: "Recovery checkpoint selected",
  LEASE_TRANSFERRED: "Standby claimed lease",
  FIRST_RESUMED_STEP_COMPLETED: "First resumed optimizer step",
  RESCUE_VERIFIED: "Coordinator recorded recovery",
  JOB_COMPLETED: "Training target reached",
  WORKER_HEARTBEAT: "Worker heartbeat",
}

export function eventName(kind: string) {
  return names[kind] ?? kind.toLowerCase().replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase())
}

export function utc(value: string) {
  return new Date(value).toISOString().slice(11, 23) + "Z"
}
