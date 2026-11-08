"use client"

import { useEffect, useRef } from "react"
import { Icon, PanelTitle } from "./ui"
import type { Replay, ReplayEvent } from "../lib/replay"

const points = [[360, 132], [120, 72], [600, 72], [120, 209], [600, 209]]
const links = [
  "M120 72H221L286 132H360",
  "M360 132H434L499 72H600",
  "M120 209H221L286 132H360",
  "M600 209H499L434 132H360",
]

function NodeGlow() {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const target = canvas.current
    if (!target) return
    const gl = target.getContext("webgl", { alpha: true, premultipliedAlpha: false })
    if (!gl) return
    const program = gl.createProgram()
    const vertex = gl.createShader(gl.VERTEX_SHADER)
    const fragment = gl.createShader(gl.FRAGMENT_SHADER)
    const buffer = gl.createBuffer()
    if (!program || !vertex || !fragment || !buffer) return
    gl.shaderSource(vertex, `
      attribute vec3 node;
      uniform float density;
      varying float center;
      void main() {
        center = node.z;
        gl_Position = vec4(node.xy, 0.0, 1.0);
        gl_PointSize = density * (56.0 + 48.0 * center);
      }`)
    gl.shaderSource(fragment, `
      precision mediump float;
      varying float center;
      void main() {
        float dist = length(gl_PointCoord - vec2(0.5));
        float fade = 1.0 - smoothstep(0.06, 0.5, dist);
        gl_FragColor = vec4(mix(vec3(.24,.42,.83), vec3(.29,.92,.85), center), fade * fade * .38);
      }`)
    gl.compileShader(vertex)
    gl.compileShader(fragment)
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)

    const render = () => {
      if (gl.isContextLost() || !gl.getProgramParameter(program, gl.LINK_STATUS)) return
      const density = Math.min(window.devicePixelRatio || 1, 2)
      target.width = Math.max(1, Math.round(target.clientWidth * density))
      target.height = Math.max(1, Math.round(target.clientHeight * density))
      gl.viewport(0, 0, target.width, target.height)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points.flatMap(([x, y], i) => [
        x / 360 - 1, 1 - y / 136, i === 0 ? 1 : 0,
      ])), gl.STATIC_DRAW)
      const position = gl.getAttribLocation(program, "node")
      gl.enableVertexAttribArray(position)
      gl.vertexAttribPointer(position, 3, gl.FLOAT, false, 0, 0)
      gl.uniform1f(gl.getUniformLocation(program, "density"), density)
      gl.drawArrays(gl.POINTS, 0, points.length)
    }
    const observer = new ResizeObserver(render)
    observer.observe(target)
    return () => {
      observer.disconnect()
      gl.deleteBuffer(buffer)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      gl.deleteProgram(program)
    }
  }, [])

  return <canvas ref={canvas} className="node-glow" aria-hidden="true" />
}

export function SystemTopology({ replay, selected }: { replay: Replay | null; selected: ReplayEvent | null }) {
  const primary = replay?.events.find((event) => event.kind === "JOB_STARTED")?.worker ?? replay?.recovery.checkpoint?.producer
  const standby = replay?.events.findLast((event) => event.kind === "LEASE_TRANSFERRED")?.worker
  const sensor = replay?.events.findLast((event) => event.sensor)?.sensor
  const activeWorker = selected?.worker
  const standbyStep = selected?.kind === "FIRST_RESUMED_STEP_COMPLETED"
  const link = selected?.sensor ? 3 : selected?.kind === "LEASE_TRANSFERRED" || standbyStep ? 1
    : selected?.kind === "CHECKPOINT_COMMITTED" && activeWorker === standby ? 1
    : selected?.kind === "CHECKPOINT_COMMITTED" && activeWorker === primary ? 0 : -1
  const packet = link === 1 && selected?.kind !== "LEASE_TRANSFERRED"
    ? "M600 72H499L434 132H360" : links[link]
  const inventory = [
    { label: replay?.mode === "local" ? "Local coordinator" : "Cloud coordinator", sub: replay ? "RECORDED" : "NO DATA", icon: "cloud" },
    { label: primary ?? "Primary worker", sub: primary ? "RECORDED PRIMARY" : "NO DATA", icon: "laptop" },
    { label: standby ?? "Standby worker", sub: standby ? "RECORDED STANDBY" : "NO DATA", icon: "laptop" },
    { label: "Raspberry Pi 5", sub: "NO CPU SAMPLE", icon: "chip" },
    { label: "ESP32 gateway", sub: sensor?.button ? "BUTTON RECORDED" : "NO DATA", icon: "radio" },
  ] as const

  return <section className="panel topology-panel" aria-label="System topology">
    <PanelTitle icon="radar" title="System topology" detail={<span className="kicker">SYSTEM MAP</span>} />
    <div className="topology">
      <NodeGlow />
      <svg viewBox="0 0 720 272" className="topology-map" aria-hidden="true">
        <defs>
          <pattern id="map-grid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M20 0H0V20" fill="none" stroke="#7d9ebf" strokeOpacity=".10" /></pattern>
          <radialGradient id="map-mask"><stop stopColor="white"/><stop offset="1" stopColor="white" stopOpacity="0"/></radialGradient>
          <mask id="map-fade"><rect width="720" height="272" fill="url(#map-mask)" /></mask>
        </defs>
        <rect width="720" height="272" fill="url(#map-grid)" mask="url(#map-fade)" />
        {[55, 74, 98].map((r) => <circle key={r} cx="360" cy="132" r={r} className="map-orbit" />)}
        {links.map((path, index) => <path key={path} d={path} className={link === index ? "map-link lit" : "map-link"} />)}
        {link >= 0 && <path key={selected?.id} d={packet} pathLength="100" className="map-packet" />}
        <path d="M13 24v-9h12m670 0h12v9M13 248v9h12m670 0h12v-9" className="map-cross" />
      </svg>
      {inventory.map((node, index) => {
        const [x, y] = points[index]
        return <div key={node.icon + index} className={`map-node node-${index} ${node.sub.startsWith("NO") ? "unseen" : ""}`}
          style={{ left: `${x / 7.2}%`, top: `${y / 2.72}%` }}>
          <div className="node-icon"><Icon name={node.icon} size={index === 0 ? 24 : 18} /></div>
          <div className="node-caption"><strong>{node.label}</strong><small>{node.sub}</small></div>
        </div>
      })}
    </div>
    <div className="topology-foot"><span><i className="status-dot" />{link >= 0 ? "Selected evidence route" : "Topology reference"}</span><span>Historical view · worker IDs from journal</span></div>
  </section>
}
