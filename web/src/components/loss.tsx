import type { Replay, ReplayEvent } from "../lib/replay"
import { Badge, PanelTitle } from "./ui"

export function TrueLossCurve({ replay, selected, onSelect }: {
  replay: Replay | null
  selected: ReplayEvent | null
  onSelect: (event: ReplayEvent) => void
}) {
  const loss = replay?.losses ?? []
  const markers = replay?.events.filter((row) => row.kind === "CHECKPOINT_COMMITTED" || row.kind === "FIRST_RESUMED_STEP_COMPLETED") ?? []
  const maxStep = Math.max(1, replay?.progress?.step ?? 0, ...loss.map((sample) => sample.step), ...markers.map((row) => row.step ?? 0))
  const top = Math.max(0.001, ...loss.map((sample) => sample.loss)) * 1.07
  const x = (step: number) => 42 + (step / maxStep) * 588
  const y = (value: number) => 138 - (value / top) * 115
  const path = loss.map((sample, index) => {
    const prev = loss[index - 1]
    const command = prev?.epoch === sample.epoch && prev.step + 1 === sample.step ? "L" : "M"
    return `${command}${x(sample.step)},${y(sample.loss)}`
  }).join(" ")
  const resume = markers.find((row) => row.kind === "FIRST_RESUMED_STEP_COMPLETED")
  const fault = replay?.trigger
  const priorStep = fault && replay?.events.findLast((event) => event.seq < fault.seq && event.worker === fault.worker && event.epoch === fault.epoch && event.step !== null)?.step
  const faultStep = fault?.step ?? priorStep

  return <section className="panel loss-panel" id="training">
    <PanelTitle icon="pulse" title="Optimizer loss" detail={<Badge source={loss.length ? "measured" : "no data"} />} />
    {loss.length ? <>
      <div className="chart-meta"><strong>{loss.length} measured {loss.length === 1 ? "sample" : "samples"}</strong><span>{loss.some((sample) => sample.origin === "worker log") ? "Local worker logs + journal" : "Coordinator journal"}</span></div>
      <svg className="loss-chart" viewBox="0 0 652 171" role="img" aria-label={`Measured loss by optimizer step, ${loss.length} samples. ${resume ? `First resumed step ${resume.step}.` : ""}`}>
        {[0, .5, 1].map((fraction) => <g key={fraction}>
          <path d={`M42 ${y(top * fraction)}H630`} className="chart-grid" />
          <text x="35" y={y(top * fraction) + 3} textAnchor="end">{(top * fraction).toPrecision(2)}</text>
        </g>)}
        {markers.filter((event) => event.kind === "CHECKPOINT_COMMITTED" && event.step !== null).map((event) =>
          <path key={event.id} d={`M${x(event.step!)} 140v5`} className={`chart-tick ${selected?.id === event.id ? "chosen" : ""}`} />)}
        {faultStep != null && <path d={`M${x(faultStep)} 20V139`} className="chart-fault" />}
        {resume?.step != null && <path d={`M${x(resume.step)} 20V139`} className="chart-resume" />}
        <path d={path} className="chart-line" />
        {loss.map((sample) => <circle key={`${sample.worker}-${sample.epoch}-${sample.step}`} cx={x(sample.step)} cy={y(sample.loss)}
          r={loss.length === 1 || sample.step === resume?.step ? 4.5 : 1.8} className="chart-sample">
          <title>{`Step ${sample.step} · loss ${sample.loss} · ${sample.worker} · ${sample.origin}`}</title>
        </circle>)}
        <text x="42" y="162">0</text><text x="630" y="162" textAnchor="end">{maxStep} steps</text>
      </svg>
      <div className="chart-legend"><span><i />Checkpoint</span>{faultStep != null && <span className="legend-fault"><i />Last recorded step before trigger</span>}
        {resume && <button className="text-button" onClick={() => onSelect(resume)}><i />Resume evidence <span>↗</span></button>}</div>
      {loss.length === 1 && <p className="subtle">Only the first resumed loss is available in this journal.</p>}
    </> : <div className="chart-empty"><IconEmpty /><p>No measured loss samples in this replay.</p></div>}
  </section>
}

function IconEmpty() {
  return <svg aria-hidden="true" viewBox="0 0 280 58" className="empty-grid"><path d="M0 10H280M0 29H280M0 48H280M35 0V58M105 0V58M175 0V58M245 0V58" /></svg>
}
