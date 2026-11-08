"use client"

import { useEffect, useState } from "react"
import type { Replay, ReplayEvent } from "../lib/replay"
import { eventName, utc } from "../lib/replay"
import { TrueLossCurve } from "./loss"
import { SystemTopology } from "./topology"
import { Badge, Icon, PanelTitle } from "./ui"

function Recovery({ replay }: { replay: Replay | null }) {
  const proof = replay?.recovery
  const metrics = [
    { label: "Recovery time", value: proof?.rto_ms != null ? (proof.rto_ms / 1000).toFixed(3) : "—", unit: "s", detail: "Detection to first optimizer step" },
    { label: "Work lost", value: proof?.rpo_steps ?? "—", unit: "steps", detail: "Known primary progress lost" },
    { label: "Last recorded step", value: replay?.progress?.step ?? "—", unit: "", detail: replay?.progress?.worker ?? "Worker not recorded" },
    { label: "Ownership epoch", value: proof?.resumed?.epoch ?? "—", unit: "", detail: proof?.resumed?.worker_id ?? "Standby not verified" },
  ]
  return <section className="panel recovery-panel" aria-label="Recovery proof">
    <PanelTitle icon="shield" title="Recovery proof" detail={<Badge source={proof?.verified_resumed ? "derived" : "no data"} />} />
    <div className="proof">
      <span className="kicker">CHECKPOINT → FIRST RESUMED STEP</span>
      <div className="continuity">
        <div><strong>{proof?.checkpoint?.step ?? "—"}</strong><small>Saved on primary</small></div>
        <Icon name="arrow" size={26} />
        <div><strong>{proof?.resumed?.step ?? "—"}</strong><small>Measured on standby</small></div>
      </div>
      <div className={`proof-state ${proof?.verified_resumed ? "verified" : ""}`}><Icon name="shield" size={15} />
        {proof?.completed_after_resume ? "Recovery verified · Training completed" : proof?.verified_resumed ? "Recovery verified" : "Awaiting verified recovery"}
      </div>
    </div>
    <dl className="metrics">{metrics.map(({ label, value, unit, detail }) =>
      <div className="metric" key={label}><dt>{label}</dt><dd>{value}{value !== "—" && unit && <small> {unit}</small>}</dd>
        <p>{value === "—" ? "Unknown in saved evidence" : detail}</p><Badge source={value === "—" ? "no data" : "derived"} /></div>
    )}</dl>
    {proof?.unknowns.length ? <details className="proof-notes"><summary>Verification limits</summary>
      <ul>{proof.unknowns.map((note) => <li key={note}>{note}</li>)}</ul>
    </details> : null}
  </section>
}

const milestoneKinds = new Set([
  "JOB_STARTED", "SENSOR_EVENT_RECEIVED", "RESCUE_REQUESTED", "PRIMARY_PROCESS_KILLED", "PRIMARY_UNREACHABLE",
  "PRIMARY_PAUSE_REQUESTED", "PRIMARY_YIELDED", "CHECKPOINT_SELECTED", "LEASE_TRANSFERRED",
  "FIRST_RESUMED_STEP_COMPLETED", "JOB_COMPLETED",
])

function FlightRecorder({ replay, selected, onSelect, loading, verify }: {
  replay: Replay | null
  selected: ReplayEvent | null
  onSelect: (event: ReplayEvent) => void
  loading: boolean
  verify: () => void
}) {
  const [all, setAll] = useState(false)
  const [notice, setNotice] = useState(false)
  const rows = replay?.events.filter((event) => all || milestoneKinds.has(event.kind) || event.id === selected?.id) ?? []
  return <section className="panel recorder-panel" id="recorder">
    <PanelTitle icon="clock" title="Flight recorder" detail={<button className="button small" disabled={loading || !replay}
      onClick={() => { setNotice(true); verify() }}><Icon name="link" size={15} />{loading ? "Checking…" : "Verify chain"}</button>} />
    <div className="recorder-toolbar">
      <div className="segmented" role="group" aria-label="Event filter">
        <button aria-pressed={!all} onClick={() => setAll(false)}>Milestones</button>
        <button aria-pressed={all} onClick={() => setAll(true)}>All events</button>
      </div>
      <span className="kicker">{replay ? `${replay.journal.count} EVENTS` : "NO JOURNAL"}</span>
    </div>
    <p className="chain-line" role="status">
      {replay ? <><span className="verified"><i className="status-dot" />{notice && !loading ? "Chain rechecked" : "Chain verified"}</span>
        <span>{replay.journal.anchored ? "Export head verified" : "No export head anchor"} · <code>{replay.journal.head}</code></span></>
        : "Open a saved journal to inspect its event chain."}
    </p>
    {rows.length ? <ol className="event-list" aria-label="Recorded events">{rows.map((event) =>
      <li key={event.id}><button className="event-row" aria-pressed={event.id === selected?.id} onClick={() => onSelect(event)}>
        <span className="event-seq">{String(event.seq).padStart(2, "0")}</span>
        <span className="event-label"><strong>{eventName(event.kind)}</strong><time dateTime={event.at}>{utc(event.at)}</time></span>
        <Badge source={event.source} /><Icon name="chevron" size={14} />
      </button></li>
    )}</ol> : <p className="empty-state">No events to display.</p>}
    {selected && <div className="event-inspector" aria-live="polite">
      <span className="kicker">EVENT {selected.seq} · {eventName(selected.kind)}</span>
      <p>{selected.worker ?? "Worker unknown"} · epoch {selected.epoch}{selected.step != null && ` · step ${selected.step}`}</p>
      {selected.hash_prefix && <p>Checkpoint SHA-256 prefix <code>{selected.hash_prefix}</code></p>}
      {selected.loss != null && <p>Measured loss <strong>{selected.loss.toPrecision(6)}</strong></p>}
      <p className="subtle">Previous <code>{selected.previous_hash}</code> <span aria-hidden="true">→</span> Event <code>{selected.hash}</code></p>
    </div>}
  </section>
}

function CheckpointLedger({ replay, onSelect }: { replay: Replay | null; onSelect: (event: ReplayEvent) => void }) {
  const commits = replay?.events.filter((event) => event.kind === "CHECKPOINT_COMMITTED" && event.hash_prefix).reverse() ?? []
  return <section className="panel checkpoint-panel">
    <PanelTitle icon="stack" title="Checkpoint ledger" detail={<Badge source={commits[0]?.source ?? "no data"} />} />
    {commits.length ? <div className="table-wrap"><table>
      <thead><tr><th scope="col">Step</th><th scope="col">Producer</th><th scope="col">SHA-256 prefix</th><th scope="col">Evidence</th></tr></thead>
      <tbody>{commits.map((event) => <tr key={event.id}>
        <td>{event.step}</td><td>{event.worker}</td><td><code>{event.hash_prefix}</code></td>
        <td><button className="text-button" aria-label={`Inspect checkpoint at step ${event.step}`} onClick={() => onSelect(event)}>
          {event.id === replay?.recovery.evidence_event_ids[0] ? "Used for recovery" : "Commit"} <span aria-hidden="true">↗</span>
        </button></td>
      </tr>)}</tbody>
    </table></div> : <p className="empty-state">No verified commit events in this replay.</p>}
  </section>
}

function SensorEvidence({ replay }: { replay: Replay | null }) {
  const sensor = replay?.events.findLast((event) => event.sensor)
  return <section className="panel sensors-panel">
    <PanelTitle icon="radio" title="Sensor evidence" detail={<span className="kicker">HISTORICAL</span>} />
    <dl className="sensor-values">
      <div><dt>Pi CPU temperature</dt><dd><Badge source="no data" /></dd></div>
      <div><dt>DS18B20 ambient</dt><dd>{sensor?.sensor?.ambient != null ? <>{sensor.sensor.ambient} °C <Badge source="measured" /></> : <Badge source="no data" />}</dd></div>
      <div><dt>ESP32 button</dt><dd><Badge source={sensor?.sensor?.button ? sensor.source : "no data"} /></dd></div>
    </dl>
    <p className="subtle">{sensor?.sensor?.button ? `Drill frame recorded at ${utc(sensor.at)}.` : "No hardware button frame in this journal."}</p>
  </section>
}

function NemotronTrace({ replay, onSelect }: { replay: Replay | null; onSelect: (event: ReplayEvent) => void }) {
  const trace = replay?.investigation
  return <section className="panel trace-panel">
    <PanelTitle icon="spark" title="Nemotron trace" detail={<Badge source={trace ? "provider" : "no data"} />} />
    {trace ? <><p className="subtle">{trace.model} · Saved advisory investigation</p>
      <ul className="tool-list">{trace.tools.map((tool) =>
        <li key={tool.name}><code>{tool.name}</code><span>{tool.event_ids.length} cited events</span></li>)}</ul>
      {trace.facts.map((fact, index) => <div className="trace-fact" key={index}><p>{fact.text}</p>
        {fact.evidence_event_ids.map((id) => {
          const event = replay.events.find((row) => row.id === id)
          return event && <button className="text-button" key={id} onClick={() => onSelect(event)}>Event {event.seq} ↗</button>
        })}
      </div>)}
      <p>{trace.outcome}</p><p className="subtle">{trace.uncertainty}</p>
    </> : <p className="empty-state">{replay?.investigation_rejected ? "Saved investigation failed validation." : "No saved investigation attached to this incident."}</p>}
  </section>
}

function ReadinessAndMessages() {
  return <div className="side-stack">
    <section className="panel status-panel">
      <PanelTitle icon="radar" title="Lifeboat Score" detail={<Badge source="no data" />} />
      <div className="score"><span className="score-ring">—</span><p>Historical replay has no current lease, standby, or telemetry freshness.</p></div>
    </section>
    <section className="panel status-panel">
      <PanelTitle icon="message" title="Photon" detail={<Badge source="no data" />} />
      <p className="empty-state">No delivery or acknowledgement evidence attached.</p>
    </section>
  </div>
}

export function Cockpit() {
  const [replay, setReplay] = useState<Replay | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch("/api/replay", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? "Replay is unavailable.")
        return data.replay as Replay | null
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setReplay(data)
          setError("")
        }
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted) {
          setReplay(null)
          setError(failure instanceof Error ? failure.message : "Replay is unavailable.")
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [revision])

  const selected = replay?.events.find((event) => event.id === selectedId)
    ?? replay?.events.find((event) => event.id === replay.recovery.evidence_event_ids.at(-1))
    ?? replay?.trigger ?? null
  const simulated = replay?.events.some((event) => event.source === "simulated")
  const select = (event: ReplayEvent) => setSelectedId(event.id)
  const inspect = (event: ReplayEvent) => {
    select(event)
    document.getElementById("recorder")?.scrollIntoView({ block: "nearest" })
  }
  const verify = () => { setLoading(true); setRevision((value) => value + 1) }

  return <>
    <a className="skip-link" href="#content">Skip to content</a>
    <header className="site-header">
      <div className="shell header-inner">
        <a href="/" className="brand"><span><Icon name="raft" size={23} /></span><strong>LIFE<span>RAFT</span><small>OPERATIONS CONSOLE</small></strong></a>
        <nav aria-label="Console sections"><a href="#overview">Overview</a><a href="#training">Training</a><a href="#recorder">Flight recorder</a></nav>
        <span className="mode-chip"><i />READ-ONLY REPLAY</span>
      </div>
    </header>
    <main id="content" className="shell">
      <div className="intro" id="overview">
        <div><div className="kicker eyebrow"><i /> COMPUTE CONTINUITY</div><h1>Recovery cockpit</h1>
          <p>Follow the checkpoint, lease transfer and first measured step on standby.</p></div>
        <div className="snapshot"><span className="kicker">EVIDENCE SNAPSHOT</span><strong>{replay?.job ?? "No journal selected"}</strong>
          <small>{replay ? new Date(replay.journal.at).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "Local console"}</small></div>
      </div>
      <div className={`replay-banner ${error ? "failed" : ""}`} role="status">
        <Icon name={error ? "bolt" : "clock"} size={17} />
        <div><strong>{error ? "Replay unavailable" : simulated ? "Contains simulated events" : replay ? (replay.mode === "local" ? "Local two-process replay" : "Saved coordinator replay") : loading ? "Checking saved evidence" : "Waiting for a saved journal"}</strong>
          <span>{error || (replay ? "Historical data. Device status and measurements reflect the saved run." : loading ? "Verifying the configured event chain." : "Set LIFERAFT_COCKPIT_JOB to open a saved event export.")}</span></div>
        {replay?.trigger && <Badge source={replay.trigger.source} />}
        {error && <button className="button small" onClick={verify} disabled={loading}>Retry</button>}
      </div>
      <div className="overview-grid"><SystemTopology replay={replay} selected={selected} /><Recovery replay={replay} /></div>
      <div className="detail-grid">
        <div className="detail-stack"><TrueLossCurve replay={replay} selected={selected} onSelect={inspect} />
          <CheckpointLedger replay={replay} onSelect={inspect} /></div>
        <FlightRecorder replay={replay} selected={selected} onSelect={select} loading={loading} verify={verify} />
      </div>
      <div className="support-grid"><SensorEvidence replay={replay} /><NemotronTrace replay={replay} onSelect={inspect} /><ReadinessAndMessages /></div>
      <footer><span>LIFERAFT / EVIDENCE CONSOLE</span><span>Journal integrity and coordinator-recorded checkpoint verification.</span></footer>
    </main>
  </>
}
