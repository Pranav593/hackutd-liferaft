"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCockpit, select, update } from "../../lib/store/cockpit-store";
import { topologyFrame, type NodeId } from "../../lib/derive/topology-frame";
import { Badge, Icon } from "../ui";
import { useTraceIds, trace } from "../../lib/store/hover-store";
import { relationIndex } from "../ui/EvidenceTrace";
const Canvas = dynamic(() => import("./engine/Canvas"), { ssr: false });
const fallback: Record<NodeId, [number, number]> = {
  coordinator: [50, 44],
  primary: [20, 28],
  standby: [80, 28],
  pi: [23, 77],
  esp32: [77, 77],
};
export function TopologyStage() {
  const r = useCockpit((s) => s.replay),
    cursor = useCockpit((s) => s.cursor),
    previous = useCockpit((s) => s.previous),
    mode = useCockpit((s) => s.topologyMode),
    motion = useCockpit((s) => s.motion),
    quality = useCockpit((s) => s.quality),
    camera = useCockpit((s) => s.camera);
  const [status, setStatus] = useState("booting"),
    [near, setNear] = useState(false),
    [systemReduced, setSystemReduced] = useState(false),
    [hover, setHover] = useState<NodeId | null>(null),
    [autoTier, setAutoTier] = useState<"high" | "mid" | "low">("mid"),
    [retry, setRetry] = useState(0);
  const container = useRef<HTMLDivElement>(null),
    buttons = useRef(new Map<NodeId, HTMLButtonElement>());
  const loadedReplay = useRef(r);
  const traceIds = useTraceIds(),
    index = useMemo(() => relationIndex(r), [r]);
  const frame = useMemo(
    () => topologyFrame(r, cursor, previous),
    [r, cursor, previous],
  );
  const focus = camera as NodeId | null;
  const reduced =
    motion === "reduced" || (motion === "system" && systemReduced);
  useEffect(() => {
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean } }
    ).connection;
    setAutoTier(
      connection?.saveData
        ? "low"
        : window.innerWidth >= 1280 && navigator.hardwareConcurrency >= 8
          ? "high"
          : "mid",
    );
    if (!r || !r.events[cursor]) return;
    if (loadedReplay.current !== r) {
      loadedReplay.current = r;
      update({ camera: null });
      return;
    }
    const event = r.events[cursor];
    const node = event.sensor
      ? "esp32"
      : (index?.get(event.id)?.edge ?? "coordinator");
    update({ camera: node });
  }, [r, cursor, index]);
  useEffect(() => {
    const query = matchMedia("(prefers-reduced-motion: reduce)");
    setSystemReduced(query.matches);
    const change = () => setSystemReduced(query.matches);
    query.addEventListener("change", change);
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(container.current!);
    return () => {
      query.removeEventListener("change", change);
      io.disconnect();
    };
  }, []);
  const label = useCallback((id: NodeId, x: number, y: number) => {
    const button = buttons.current.get(id);
    const stage = container.current;
    if (button && stage) {
      const px = (Math.max(9, Math.min(91, x)) / 100) * stage.clientWidth;
      const py = (Math.max(10, Math.min(81, y)) / 100) * stage.clientHeight;
      button.style.transform = `translate3d(${px}px,${py}px,0) translate(-50%,-50%)`;
    }
  }, []);
  const onStatus = useCallback((s: string) => setStatus(s), []);
  const onHover = useCallback((id: NodeId | null) => setHover(id), []);
  const onNode = (id: NodeId) => {
    const node = frame.nodes.find((n) => n.id === id);
    update({ camera: id });
    if (node?.eventId) select(node.eventId);
  };
  const gl = near && !!r && mode === "3d" && status !== "failed";
  const ok = gl && status === "ok";
  const tooltip = frame.nodes.find((n) => n.id === hover);
  return (
    <section className="topo-panel" aria-label="System topology">
      <div className="topo-heading">
        <span className="kicker">FIVE NODES / ONE CONTINUOUS JOB</span>
        <div className="segmented">
          <button
            aria-pressed={mode === "3d"}
            onClick={() => {
              update({ topologyMode: "3d" });
              setStatus("booting");
              setRetry((n) => n + 1);
            }}
          >
            3D
          </button>
          <button
            aria-pressed={mode === "2d"}
            onClick={() => update({ topologyMode: "2d" })}
          >
            2D map
          </button>
        </div>
      </div>
      <div
        ref={container}
        className={`topo-stage ${ok ? "has-gl" : ""}`}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            setHover(null);
            update({ camera: null });
          }
        }}
      >
        <svg className="topo-map" viewBox="0 0 800 450" aria-hidden="true">
          <defs>
            <pattern
              id="topo-grid"
              width="32"
              height="32"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M32 0H0V32"
                fill="none"
                stroke="#25415c"
                strokeWidth=".6"
              />
            </pattern>
            <radialGradient id="topo-light">
              <stop stopColor="#164350" stopOpacity=".4" />
              <stop offset="1" stopColor="#060b16" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="800" height="450" fill="url(#topo-grid)" />
          <ellipse
            cx="400"
            cy="220"
            rx="330"
            ry="210"
            fill="url(#topo-light)"
          />
          {frame.nodes
            .filter((n) => n.id !== "coordinator")
            .map((n) => {
              const [x, y] = fallback[n.id];
              return (
                <path
                  key={n.id}
                  d={`M${x * 8} ${y * 4.5} Q400 ${y * 4.5} 400 198`}
                  fill="none"
                  stroke={n.active ? "#5ff0d6" : "#62779c"}
                  strokeWidth={n.active ? 2 : 1}
                  strokeDasharray={n.seen ? "" : "5 7"}
                />
              );
            })}
          <circle cx="400" cy="198" r="38" fill="#142d43" stroke="#5ff0d6" />
          <circle cx="400" cy="198" r="52" fill="none" stroke="#2a656e" />
        </svg>
        {gl && (
          <Canvas
            key={retry}
            frame={frame}
            focus={focus}
            reduced={reduced}
            tier={quality === "auto" ? autoTier : quality}
            onStatus={onStatus}
            onLabel={label}
            onHover={onHover}
            onNode={onNode}
          />
        )}
        {frame.nodes.map((n) => (
          <button
            ref={(el) => {
              if (el) buttons.current.set(n.id, el);
              else buttons.current.delete(n.id);
            }}
            key={n.id}
            style={
              !ok
                ? {
                    left: `${fallback[n.id][0]}%`,
                    top: `${fallback[n.id][1]}%`,
                    transform: "translate(-50%,-50%)",
                  }
                : { left: 0, top: 0 }
            }
            className={`topo-node ${n.seen ? "" : "unseen"} ${n.active ? "active" : ""} ${traceIds && n.eventId && !traceIds.has(n.eventId) ? "trace-muted" : ""}`}
            aria-label={`${n.label}. ${n.detail}`}
            aria-pressed={camera === n.id}
            aria-describedby={hover === n.id ? "node-tooltip" : undefined}
            onMouseEnter={() => {
              setHover(n.id);
              trace(
                n.eventId
                  ? (index?.get(n.eventId)?.eventIds ?? new Set([n.eventId]))
                  : null,
              );
            }}
            onMouseLeave={() => {
              setHover(null);
              trace(null);
            }}
            onFocus={() => setHover(n.id)}
            onBlur={() => setHover(null)}
            onClick={() => {
              update({ camera: n.id });
              if (n.eventId) select(n.eventId);
            }}
          >
            <Icon
              name={
                n.id === "coordinator"
                  ? "cloud"
                  : n.id === "pi"
                    ? "chip"
                    : n.id === "esp32"
                      ? "radio"
                      : "laptop"
              }
              size={22}
            />
            <strong>{n.label}</strong>
            <small>
              {n.active
                ? "Owner as of cursor"
                : !n.seen
                  ? "NO DATA"
                  : n.id === "coordinator"
                    ? `Epoch ${frame.epoch ?? "—"}`
                    : "Recorded node"}
            </small>
          </button>
        ))}
        {tooltip && (
          <div
            id="node-tooltip"
            role="tooltip"
            className="topo-tooltip"
            onMouseEnter={() => setHover(tooltip.id)}
            onMouseLeave={() => {
              setHover(null);
              trace(null);
            }}
          >
            <strong>{tooltip.label}</strong>
            <p>{tooltip.detail}</p>
            <Badge source={tooltip.source} />
          </div>
        )}
        {!r && (
          <p className="topo-empty">
            Open a saved journal to see who owned the job and when.
          </p>
        )}
        <div className="topo-caption">
          <span>Hover to preview. Select to inspect.</span>
          <button
            className="text-button"
            onClick={() => update({ camera: null })}
          >
            Overview ↺
          </button>
        </div>
      </div>
      <div className="topo-status">
        <span>
          {mode === "2d"
            ? "Accessible 2D map"
            : status === "lost"
              ? "Graphics paused. Restoring…"
              : status === "failed"
                ? "3D unavailable. Showing the 2D map."
                : ok
                  ? "WebGL · render on demand"
                  : "Static map · loading 3D on demand"}
        </span>
        {status === "failed" && (
          <button
            className="text-button"
            onClick={() => {
              setStatus("booting");
              setRetry((v) => v + 1);
            }}
          >
            Retry 3D
          </button>
        )}
        <label>
          Quality{" "}
          <select
            aria-label="Graphics quality"
            value={quality}
            onChange={(e) =>
              update({ quality: e.target.value as typeof quality })
            }
          >
            {["auto", "high", "mid", "low"].map((q) => (
              <option key={q}>{q}</option>
            ))}
          </select>
        </label>
      </div>
      {frame.transition && (
        <p className="topo-evidence">
          <Badge source={frame.transition.source} />
          {frame.transition.text}
        </p>
      )}
      <ol className="sr-only">
        {frame.nodes.map((n) => (
          <li key={n.id}>
            {n.label}: {n.detail}
          </li>
        ))}
      </ol>
    </section>
  );
}
