// View model for the Mission Control dashboard. Both data sources (saved
// local drill and live hosted coordinator journal) are normalised into the same
// event shape so one UI can tell one story. Nothing here invents measurements:
// unknown stays null and the UI says "unknown".
import type { Replay } from "./replay";
import type { StoryData } from "../components/story/types";

export type Ev = {
  id: string;
  seq: number;
  type: string;
  at: string;
  source: string; // measured | injected | derived | simulated | provider ...
  worker: string | null;
  epoch: number;
  step: number | null;
  loss: number | null;
  cpu: number | null;
  hash: string;
  data: Record<string, unknown>;
};

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

export function fromStory(story: StoryData): Ev[] {
  return story.events.map((e) => ({
    id: e.event_id,
    seq: e.seq ?? 0,
    type: e.event_type,
    at: e.created_utc,
    source: e.source_type,
    worker: e.worker_id,
    epoch: e.lease_epoch,
    step: num(e.evidence.step) ?? num(e.evidence.checkpoint_step),
    loss: num(e.evidence.loss),
    cpu: num(e.evidence.cpu_c),
    hash: e.event_hash,
    data: e.evidence,
  }));
}

export function fromLive(replay: Replay): Ev[] {
  return replay.events.map((e) => ({
    id: e.id,
    seq: e.seq,
    type:
      e.kind === "SENSOR_EVENT_RECEIVED" && e.sensor?.button
        ? "SENSOR_BUTTON"
        : e.kind,
    at: e.at,
    source: e.source,
    worker: e.worker,
    epoch: e.epoch,
    step: e.step,
    loss: e.loss,
    cpu: e.cpu_c,
    hash: e.hash,
    data: { risk: e.risk, sensor: e.sensor, checkpoint_id: e.checkpoint_id },
  }));
}

export type ChapterId =
  | "run"
  | "warn"
  | "decide"
  | "save"
  | "guard"
  | "handoff"
  | "resume"
  | "brief";

export type Chapter = {
  id: ChapterId;
  title: string;
  plain: string;
  tech: string;
  done: boolean;
  at: string | null;
  evidence: Ev | null;
  tone: "ok" | "warn" | "bad" | "idle";
};

const WARN = new Set(["SENSOR_BUTTON", "PRIMARY_PROCESS_KILLED", "PRIMARY_UNREACHABLE"]);

function first(events: Ev[], test: (e: Ev) => boolean) {
  return events.find(test) ?? null;
}

export function utcTime(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(11, 19) + "Z";
}

export type Forecast = {
  eligible: boolean;
  secondsToLimit: number | null;
  slope: number | null;
  threshold: number;
  fit: number | null;
};

export type Derived = {
  chapters: Chapter[];
  phase: { headline: string; sub: string; tone: "ok" | "warn" | "bad" | "idle" };
  owner: string | null;
  primary: string | null;
  standby: string | null;
  epoch: number;
  step: number | null;
  savedStep: number | null;
  handedOff: boolean;
  resumed: boolean;
  completed: boolean;
  warned: boolean;
  temps: { x: number; y: number; source: string }[];
  forecast: Forecast | null;
  guards: { rejectedCheckpoint: Ev | null; staleLease: Ev | null; verified: Ev | null; transfer: Ev | null };
  rto: number | null;
  rpo: number | null;
};

export function derive(events: Ev[], cursor: number, scenario: string): Derived {
  const seen = events.slice(0, Math.max(0, cursor + 1));
  const started = first(seen, (e) => e.type === "JOB_STARTED");
  const primary = started?.worker ?? seen.find((e) => e.worker && e.epoch === 1)?.worker ?? null;
  const transfer = first(seen, (e) => e.type === "LEASE_TRANSFERRED");
  const standby =
    transfer?.worker ??
    seen.find((e) => e.type === "STANDBY_REGISTERED")?.worker ??
    null;
  const warnEv =
    first(seen, (e) => e.type === "FAILURE_FORECAST" && e.data.eligible === true) ??
    first(seen, (e) => WARN.has(e.type));
  const decide = first(seen, (e) => e.type === "RESCUE_REQUESTED");
  const save = first(seen, (e) => e.type === "PRIMARY_YIELDED") ?? first(seen, (e) => e.type === "CHECKPOINT_SELECTED");
  const rejected = first(seen, (e) => e.type === "CHECKPOINT_REJECTED");
  const stale = first(seen, (e) => e.type === "STALE_LEASE_REJECTED");
  const resumedEv = first(seen, (e) => e.type === "FIRST_RESUMED_STEP_COMPLETED");
  const verified = first(seen, (e) => e.type === "RESCUE_VERIFIED");
  const done = first(seen, (e) => e.type === "JOB_COMPLETED");
  const brief = first(seen, (e) => e.type === "REHEARSAL_MESSAGE" || e.type.startsWith("PHOTON_"));
  const guard = rejected ?? stale;

  let step: number | null = null;
  for (const e of seen) if (e.step != null) step = e.step;
  const savedEv = [...seen].reverse().find((e) => e.type === "CHECKPOINT_COMMITTED" || e.type === "PRIMARY_YIELDED" || e.type === "CHECKPOINT_SELECTED");

  const warnTitle =
    scenario === "crash"
      ? "Machine went silent"
      : scenario === "zombie"
        ? "Primary stops responding"
        : "Early warning";
  const warnPlain =
    scenario === "crash"
      ? "The training process died without notice. The lease clock noticed it was gone."
      : scenario === "zombie"
        ? "The primary looks dead, so the coordinator declares it failed."
        : warnEv?.type === "SENSOR_BUTTON"
          ? "A physical cooling-alarm button on the ESP32 raised a drill. This is injected, not a real overheat."
          : "Temperature is climbing in a straight line. We can tell when it will hit the limit.";
  const chapters: Chapter[] = [
    {
      id: "run",
      title: "Training is running",
      plain: "A real PyTorch model trains on the primary machine and saves safe copies as it goes.",
      tech: "JOB_STARTED · lease epoch 1 · checkpoints committed atomically with SHA-256",
      done: !!started,
      at: started?.at ?? null,
      evidence: started,
      tone: started ? "ok" : "idle",
    },
    {
      id: "warn",
      title: warnTitle,
      plain: warnPlain,
      tech: warnEv ? `${warnEv.type} · source ${warnEv.source}` : "waiting",
      done: !!warnEv,
      at: warnEv?.at ?? null,
      evidence: warnEv,
      tone: warnEv ? "warn" : "idle",
    },
    {
      id: "decide",
      title: "Decision",
      plain: "The coordinator's rules (not the AI) decide to evacuate while the old machine is still alive.",
      tech: "RESCUE_REQUESTED · policy engine owns state transitions",
      done: !!decide || !!save,
      at: (decide ?? save)?.at ?? null,
      evidence: decide ?? save,
      tone: decide || save ? "ok" : "idle",
    },
    {
      id: "save",
      title: "Safe copy saved",
      plain: "Model, optimizer and random-number state are frozen into a checkpoint and fingerprinted.",
      tech: savedEv ? `step ${savedEv.step ?? "?"} · sha256 ${String(savedEv.data.sha256 ?? "").slice(0, 12) || "verified"}` : "waiting",
      done: !!save,
      at: save?.at ?? null,
      evidence: save,
      tone: save ? "ok" : "idle",
    },
  ];
  if (guard) {
    chapters.push({
      id: "guard",
      title: rejected ? "Bad copy rejected" : "Impostor blocked",
      plain: rejected
        ? "A corrupted checkpoint failed its fingerprint check. It was refused and an older good one was used."
        : "The old machine woke up and tried to write. Its expired ticket (epoch) was refused.",
      tech: `${guard.type} · epoch ${guard.epoch}`,
      done: true,
      at: guard.at,
      evidence: guard,
      tone: "bad",
    });
  }
  chapters.push(
    {
      id: "handoff",
      title: "Baton passed",
      plain: `Ownership moves to ${transfer?.worker ?? "the standby"}. The old owner is fenced out so only one machine can write.`,
      tech: transfer ? `LEASE_TRANSFERRED · epoch ${num(transfer.data.previous_epoch) ?? "?"} → ${transfer.epoch}` : "waiting",
      done: !!transfer,
      at: transfer?.at ?? null,
      evidence: transfer,
      tone: transfer ? "ok" : "idle",
    },
    {
      id: "resume",
      title: "Training resumed",
      plain: resumedEv
        ? `The next real training step ran on ${resumedEv.worker} (step ${resumedEv.step}). That is the proof, not a promise.`
        : "Waiting for the first real step on the new machine.",
      tech: resumedEv ? `FIRST_RESUMED_STEP_COMPLETED · step ${resumedEv.step} · loss ${resumedEv.loss?.toFixed(4) ?? "n/a"}` : "waiting",
      done: !!resumedEv,
      at: resumedEv?.at ?? null,
      evidence: resumedEv,
      tone: resumedEv ? "ok" : "idle",
    },
    {
      id: "brief",
      title: "Team briefed",
      plain: "The on-call engineer gets a plain-language message and a handoff brief built from verified facts.",
      tech: brief ? `${brief.type} · ${brief.source}` : "waiting",
      done: !!brief,
      at: brief?.at ?? null,
      evidence: brief,
      tone: brief ? "ok" : "idle",
    },
  );

  const resumed = !!resumedEv;
  const completed = !!done;
  const handedOff = !!transfer;
  const owner = transfer?.worker ?? primary;

  let phase: Derived["phase"] = { headline: "Waiting for a job", sub: "Nothing is running yet.", tone: "idle" };
  if (completed)
    phase = { headline: "Job finished. Nothing was lost.", sub: `Training reached its target on ${owner}.`, tone: "ok" };
  else if (resumed)
    phase = { headline: `Back in business on ${owner}`, sub: "Training continues from the exact point it stopped.", tone: "ok" };
  else if (handedOff)
    phase = { headline: "Handing over the job", sub: "New owner is loading the verified checkpoint.", tone: "warn" };
  else if (save || decide)
    phase = { headline: "Saving a safe copy", sub: "Preparing to move work before the machine fails.", tone: "warn" };
  else if (warnEv)
    phase = { headline: scenario === "crash" ? "Machine lost" : "Trouble predicted", sub: "A problem was detected. Recovery is starting.", tone: "bad" };
  else if (started)
    phase = { headline: "Training is healthy", sub: `${primary ?? "Primary"} is training and saving safe copies.`, tone: "ok" };

  const temps: Derived["temps"] = [];
  let tIdx = 0;
  for (const e of seen) {
    if (e.cpu != null) {
      const t = num(e.data.elapsed_s);
      temps.push({ x: t ?? tIdx, y: e.cpu, source: e.source });
      tIdx++;
    }
  }
  let forecast: Forecast | null = null;
  for (const e of seen) {
    if (e.type === "FAILURE_FORECAST" && e.data.eligible === true) {
      forecast = {
        eligible: true,
        secondsToLimit: num(e.data.seconds_to_limit),
        slope: num(e.data.slope_c_per_s),
        threshold: num(e.data.threshold_c) ?? 80,
        fit: num(e.data.fit_quality),
      };
    }
  }
  const proof = verified ?? resumedEv;
  return {
    chapters,
    phase,
    owner,
    primary,
    standby,
    epoch: Math.max(1, ...seen.map((e) => e.epoch)),
    step,
    savedStep: savedEv?.step ?? null,
    handedOff,
    resumed,
    completed,
    warned: !!warnEv,
    temps,
    forecast,
    guards: { rejectedCheckpoint: rejected, staleLease: stale, verified: proof, transfer },
    rto: num(proof?.data.rto_ms),
    rpo: num(proof?.data.rpo_steps),
  };
}

export function toolSummary(tool: string, result: Record<string, unknown> | undefined): string {
  if (!result) return "";
  if (typeof result.seconds_to_limit === "number")
    return `Projected limit in ${result.seconds_to_limit.toFixed(0)} s (${(Number(result.slope_c_per_s) || 0).toFixed(2)} °C/s)`;
  if (Array.isArray(result.samples)) return `Read ${result.samples.length} temperature samples`;
  if (typeof result.selected === "string") return `Picked ${result.selected}: ${String(result.reason ?? "")}`;
  if (typeof result.recommended_interval === "number")
    return `Suggested saving every ${result.recommended_interval} steps (advisory only)`;
  if (result.verified === true) return `Checkpoint at step ${result.step} passes SHA-256 check`;
  if (Array.isArray(result.baseline)) return "Compared recovered run with an uninterrupted ghost run";
  if (typeof result.text === "string") return "Wrote the shift handoff brief";
  return tool.replaceAll("_", " ");
}
