"use client";
import { useEffect, useMemo, useState } from "react";
import { useCockpit, select } from "../../lib/store/cockpit-store";
import { decimate, lossSegments, nearestEvent } from "../../lib/derive/loss";
import type { LossSample } from "../../lib/replay";
import { Badge, PanelTitle } from "../ui";
import { relationIndex } from "../ui/EvidenceTrace";
import { trace } from "../../lib/store/hover-store";
export function LossChart() {
  const r = useCockpit((s) => s.replay),
    cursor = useCockpit((s) => s.cursor);
  const [zoom, setZoom] = useState<[number, number] | null>(null),
    [samplePage, setSamplePage] = useState(0),
    [log, setLog] = useState(false),
    [hover, setHover] = useState<LossSample | null>(null),
    [drag, setDrag] = useState<number | null>(null);
  const all = r?.losses ?? [],
    max = Math.max(1, r?.progress?.step ?? 0, ...all.map((s) => s.step));
  const [lo, hi] = zoom ?? [0, max];
  const samples = useMemo(
    () =>
      decimate(
        (r?.losses ?? []).filter((s) => s.step >= lo && s.step <= hi),
        600,
        r?.recovery.resumed?.step,
      ),
    [r, lo, hi],
  );
  const positive = all.filter((s) => s.loss > 0),
    min = Math.min(...positive.map((s) => s.loss)),
    top = Math.max(0.001, ...samples.map((s) => s.loss)) * 1.07;
  const x = (step: number) => 48 + ((step - lo) / Math.max(1, hi - lo)) * 572,
    val = (v: number) => (log ? Math.log10(Math.max(v, min)) : v),
    bottom = log ? val(min) : 0,
    high = log ? val(top) : top;
  const y = (loss: number) =>
    158 - ((val(loss) - bottom) / Math.max(0.00001, high - bottom)) * 130;
  const current = r?.events[cursor],
    resume = r?.events.find((e) => e.kind === "FIRST_RESUMED_STEP_COMPLETED"),
    trigger = r?.trigger;
  const cursorStep =
    current?.step ??
    r?.events.slice(0, cursor + 1).findLast((e) => e.step !== null)?.step;
  useEffect(() => {
    const reset = (e: KeyboardEvent) => {
      if (
        e.key === "0" &&
        !(
          e.target instanceof HTMLElement &&
          e.target.closest(
            "input,textarea,select,[contenteditable],dialog,[role=dialog]",
          )
        )
      )
        setZoom(null);
    };
    window.addEventListener("keydown", reset);
    return () => window.removeEventListener("keydown", reset);
  }, []);
  const future = (s: LossSample) =>
    !!current && Date.parse(s.at) > Date.parse(current.at);
  useEffect(() => {
    const event = hover && r ? nearestEvent(r, hover) : null;
    trace(event ? (relationIndex(r)?.get(event.id)?.eventIds ?? null) : null);
    return () => trace(null);
  }, [hover, r]);
  const faultStep =
    trigger?.step ??
    r?.events.findLast(
      (e) =>
        trigger &&
        e.seq < trigger.seq &&
        e.worker === r.recovery.checkpoint?.producer &&
        e.step != null,
    )?.step;
  const pointerStep = (clientX: number, rect: DOMRect) =>
    Math.max(
      lo,
      Math.min(
        hi,
        lo +
          ((((clientX - rect.left) / rect.width) * 652 - 48) / 572) * (hi - lo),
      ),
    );
  const zoomBy = (factor: number) => {
    const mid = (lo + hi) / 2,
      half = Math.max(1, ((hi - lo) * factor) / 2);
    setZoom([Math.max(0, mid - half), Math.min(max, mid + half)]);
  };
  return (
    <section className="panel loss-panel">
      <PanelTitle
        icon="pulse"
        title="Optimizer loss"
        detail={<Badge source={all.length ? "measured" : "no data"} />}
      />
      {all.length ? (
        <>
          <div className="chart-meta">
            <span>
              {all.length} measured {all.length === 1 ? "sample" : "samples"}
            </span>
            <div className="inline-actions">
              {max > 2 && (
                <>
                  <button
                    className="text-button"
                    onClick={() => zoomBy(0.5)}
                    aria-label="Zoom in loss chart"
                  >
                    ＋
                  </button>
                  <button
                    className="text-button"
                    onClick={() => zoomBy(2)}
                    aria-label="Zoom out loss chart"
                  >
                    −
                  </button>
                  <button className="text-button" onClick={() => setZoom(null)}>
                    Reset zoom
                  </button>
                </>
              )}
              {positive.length === all.length && top / min > 20 && (
                <button
                  className="text-button"
                  aria-pressed={log}
                  onClick={() => setLog((v) => !v)}
                >
                  Log scale
                </button>
              )}
            </div>
          </div>
          <div
            className="chart-interactive"
            tabIndex={0}
            role="group"
            aria-label="Loss chart. Drag to zoom, double click or 0 to reset. Plus and minus zoom."
            onKeyDown={(e) => {
              if (e.key === "0") setZoom(null);
              if (e.key === "+") zoomBy(0.5);
              if (e.key === "-") zoomBy(2);
            }}
          >
            <svg
              viewBox="0 0 652 198"
              className="loss-chart"
              role="img"
              aria-label={`${all.length} measured loss samples by optimizer step. ${all.length === 1 ? "Only the first resumed loss is available." : ""}`}
              onDoubleClick={() => setZoom(null)}
              onPointerMove={(e) => {
                const step = pointerStep(
                  e.clientX,
                  e.currentTarget.getBoundingClientRect(),
                );
                setHover(
                  samples.reduce<LossSample | null>(
                    (a, s) =>
                      !a || Math.abs(s.step - step) < Math.abs(a.step - step)
                        ? s
                        : a,
                    null,
                  ),
                );
              }}
              onPointerLeave={() => setHover(null)}
              onPointerDown={(e) => {
                setDrag(
                  pointerStep(
                    e.clientX,
                    e.currentTarget.getBoundingClientRect(),
                  ),
                );
                e.currentTarget.setPointerCapture(e.pointerId);
              }}
              onPointerUp={(e) => {
                const end = pointerStep(
                  e.clientX,
                  e.currentTarget.getBoundingClientRect(),
                );
                if (drag != null && Math.abs(end - drag) > 2)
                  setZoom([Math.min(drag, end), Math.max(drag, end)]);
                else if (hover && r) {
                  const event = nearestEvent(r, hover);
                  if (event) select(event.id);
                }
                setDrag(null);
              }}
            >
              {[0, 0.5, 1].map((t) => (
                <g key={t}>
                  <path d={`M48 ${158 - t * 130}H620`} className="chart-grid" />
                  <text x="40" y={162 - t * 130} textAnchor="end">
                    {(log
                      ? 10 ** (bottom + t * (high - bottom))
                      : top * t
                    ).toPrecision(2)}
                  </text>
                </g>
              ))}
              {lossSegments(
                (r?.losses ?? []).filter((s) => s.step >= lo && s.step <= hi),
              )
                .flatMap((segment) => {
                  const split = segment.findIndex(future);
                  return split < 0
                    ? [{ samples: segment, future: false }]
                    : split === 0
                      ? [{ samples: segment, future: true }]
                      : [
                          { samples: segment.slice(0, split), future: false },
                          { samples: segment.slice(split - 1), future: true },
                        ];
                })
                .map(({ samples: segment, future }, i) => (
                  <path
                    key={i}
                    d={decimate(segment, 600, r?.recovery.resumed?.step)
                      .map(
                        (s, j) => `${j ? "L" : "M"}${x(s.step)},${y(s.loss)}`,
                      )
                      .join(" ")}
                    fill="none"
                    stroke={
                      future
                        ? "var(--ink-3)"
                        : segment[0].epoch === 1
                          ? "var(--blue)"
                          : "var(--teal)"
                    }
                    strokeWidth="2"
                  />
                ))}
              {r?.events
                .filter(
                  (e) =>
                    e.kind === "CHECKPOINT_COMMITTED" &&
                    e.step != null &&
                    e.step >= lo &&
                    e.step <= hi,
                )
                .map((e) => (
                  <path
                    key={e.id}
                    d={`M${x(e.step!)} 160v6`}
                    className="chart-tick"
                  />
                ))}
              {faultStep != null && faultStep >= lo && faultStep <= hi && (
                <path d={`M${x(faultStep)} 22V158`} className="chart-fault" />
              )}
              {resume?.step != null &&
                resume.step >= lo &&
                resume.step <= hi && (
                  <path
                    d={`M${x(resume.step)} 22V158`}
                    className="chart-resume"
                  />
                )}
              {samples.map((s) => (
                <circle
                  key={`${s.worker}-${s.epoch}-${s.step}`}
                  cx={x(s.step)}
                  cy={y(s.loss)}
                  r={all.length === 1 ? 6 : 2.5}
                  fill={
                    s.origin === "journal"
                      ? "var(--bg-1)"
                      : s.epoch === 1
                        ? "var(--blue)"
                        : "var(--teal)"
                  }
                  stroke={s.epoch === 1 ? "var(--blue)" : "var(--teal)"}
                  className={
                    current && Date.parse(s.at) > Date.parse(current.at)
                      ? "future-sample"
                      : ""
                  }
                >
                  <title>{`Step ${s.step} · loss ${s.loss} · ${s.worker} · ${s.origin}`}</title>
                </circle>
              ))}
              {cursorStep != null && cursorStep >= lo && cursorStep <= hi && (
                <path d={`M${x(cursorStep)} 22V160`} className="chart-cursor" />
              )}
              {hover && (
                <path
                  d={`M${x(hover.step)} 22V158`}
                  className="chart-crosshair"
                />
              )}
              <text x="48" y="181">
                {Math.round(lo)}
              </text>
              <text x="620" y="181" textAnchor="end">
                {Math.round(hi)}
              </text>
              <text x="334" y="195" textAnchor="middle">
                optimizer step
              </text>
              <text x="3" y="14">
                loss
              </text>
            </svg>
          </div>
          <p className="chart-readout" role="status">
            {hover
              ? `Step ${hover.step} · loss ${hover.loss.toPrecision(6)} · ${hover.worker} · ${hover.origin}`
              : all.length === 1
                ? "1 measured sample. Only the first resumed loss is available in this journal."
                : "Solid: worker log · Hollow: coordinator journal · Blue: epoch 1 · Teal: epoch 2"}{" "}
            <Badge source="measured" />
          </p>
          <details>
            <summary>View measured samples as table</summary>
            <div className="table-wrap samples-table">
              <table>
                <thead>
                  <tr>
                    <th>Step</th>
                    <th>Loss</th>
                    <th>Worker</th>
                    <th>Origin</th>
                  </tr>
                </thead>
                <tbody>
                  {all
                    .slice(samplePage * 200, (samplePage + 1) * 200)
                    .map((s) => (
                      <tr key={`${s.worker}-${s.epoch}-${s.step}`}>
                        <td>{s.step}</td>
                        <td>{s.loss.toPrecision(6)}</td>
                        <td>{s.worker}</td>
                        <td>{s.origin}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {all.length > 200 && (
              <nav aria-label="Loss sample pages">
                <button
                  disabled={samplePage === 0}
                  onClick={() => setSamplePage((p) => p - 1)}
                >
                  Previous samples
                </button>
                <span>
                  {" "}
                  Page {samplePage + 1} of {Math.ceil(all.length / 200)}{" "}
                </span>
                <button
                  disabled={(samplePage + 1) * 200 >= all.length}
                  onClick={() => setSamplePage((p) => p + 1)}
                >
                  Next samples
                </button>
              </nav>
            )}
          </details>
        </>
      ) : (
        <div className="chart-empty">
          <p>No measured loss samples in this replay.</p>
          <Badge source="no data" />
        </div>
      )}
    </section>
  );
}
