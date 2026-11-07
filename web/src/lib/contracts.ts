type Id<K extends string> = string & { readonly __identity: K }
export type RunId = Id<"run">
export type JobId = Id<"job">
export type WorkerId = Id<"worker">
export type IncidentId = Id<"incident">
export type CheckpointId = Id<"checkpoint">
export type Source = "measured" | "injected" | "derived" | "provider" | "simulated"

export interface CheckpointManifest {
  schema_version: 1
  checkpoint_id: CheckpointId
  job_id: JobId
  run_id: RunId
  step_completed: number
  worker_id: WorkerId
  lease_epoch: number
  path: string
  sha256: string
  size_bytes: number
  dataset_fingerprint: string
  config_fingerprint: string
  model_version: string
  created_utc: string
  committed_utc: string | null
  status: "VERIFIED" | "COMMITTED"
}

export interface IncidentEvent {
  schema_version: 1
  event_id: string
  incident_id: IncidentId | null
  job_id: JobId
  created_utc: string
  event_type: string
  source_type: Source
  trigger_event_id: string | null
  worker_id: WorkerId | null
  lease_epoch: number
  severity: "INFO" | "WARNING" | "ERROR"
  message: string
  evidence: Record<string, unknown>
}

export interface WorkerSystem {
  os: string
  arch: string
  pi_cpu_temp_c: number | null
  cpu_temp_valid: boolean
}

export interface WorkerCheckpoint {
  last_committed_id: CheckpointId | null
}

export interface WorkerHeartbeat {
  protocol_version: 1
  request_id: string
  job_id: JobId
  worker_id: WorkerId
  lease_epoch: number
  client_utc: string
  step_completed: number
  status: "RUNNING" | "STANDBY" | "PAUSED" | "STOPPED"
  system: WorkerSystem
  checkpoint: WorkerCheckpoint
}

export interface SensorEvent {
  protocol_version: 1
  event_id: string
  device_id: string
  bridge_id: string
  sequence: number
  source_type: "measured" | "injected" | "simulated"
  event_type: "TELEMETRY" | "COOLING_FAILURE_TEST"
  ambient_temp_c: number | null
  ambient_valid: boolean
  bridge_received_utc: string
}
