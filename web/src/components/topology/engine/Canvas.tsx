"use client";
import { useEffect, useRef } from "react";
import { TopologyEngine, type Tier } from "./TopologyEngine";
import type { NodeId, TopologyFrame } from "../../../lib/derive/topology-frame";
export default function Canvas({
  frame,
  focus,
  reduced,
  tier,
  onStatus,
  onLabel,
  onHover,
  onNode,
}: {
  frame: TopologyFrame;
  focus: NodeId | null;
  reduced: boolean;
  tier: Tier;
  onStatus: (s: string) => void;
  onLabel: (id: NodeId, x: number, y: number) => void;
  onHover: (id: NodeId | null) => void;
  onNode: (id: NodeId) => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<TopologyEngine | null>(null),
    latest = useRef({ frame, focus, reduced, tier });
  latest.current = { frame, focus, reduced, tier };
  useEffect(() => {
    const c = canvas.current!;
    let dead = false;
    const restores: number[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let injectionTimer: ReturnType<typeof setTimeout> | undefined;
    function create() {
      try {
        engine.current = new TopologyEngine(c, {
          tier: latest.current.tier,
          reduced: latest.current.reduced,
          label: onLabel,
        });
        engine.current.setFrame(latest.current.frame);
        engine.current.setCamera(latest.current.focus);
        onStatus("ok");
      } catch {
        c.dataset.graphicsFailure = "initialization";
        engine.current?.dispose(false);
        engine.current = null;
        onStatus("failed");
      }
    }
    function lost(e: Event) {
      e.preventDefault();
      if (dead) return;
      onStatus("lost");
      c.dataset.contextLosses = String(
        Number(c.dataset.contextLosses ?? "0") + 1,
      );
      timer = setTimeout(() => {
        if (!dead) onStatus("failed");
      }, 4000);
    }
    function restored() {
      if (dead) return;
      clearTimeout(timer);
      const now = Date.now();
      restores.push(now);
      if (restores.filter((t) => now - t < 60000).length > 3) {
        onStatus("failed");
        return;
      }
      engine.current?.dispose(false);
      create();
      c.dataset.contextRestores = String(restores.length);
    }
    c.addEventListener("webglcontextlost", lost);
    c.addEventListener("webglcontextrestored", restored);
    create();
    const mode = new URLSearchParams(location.search).get("gl");
    if (mode === "lose" && engine.current) {
      const ext = engine.current.renderer
        .getContext()
        .getExtension("WEBGL_lose_context");
      ext?.loseContext();
      injectionTimer = setTimeout(() => ext?.restoreContext(), 400);
    }
    if (mode === "leak-check") {
      let clean = !!engine.current;
      for (let i = 0; i < 20; i++) {
        const info = engine.current?.dispose(false);
        if (info && (info.geometries !== 0 || info.textures !== 0))
          clean = false;
        create();
      }
      c.dataset.leakCheck = clean ? "passed" : "failed";
    }
    return () => {
      dead = true;
      clearTimeout(timer);
      clearTimeout(injectionTimer);
      c.removeEventListener("webglcontextlost", lost);
      c.removeEventListener("webglcontextrestored", restored);
      engine.current?.dispose();
      engine.current = null;
    };
  }, [onLabel, onStatus]);
  useEffect(() => {
    engine.current?.setFrame(frame);
  }, [frame]);
  useEffect(() => {
    engine.current?.setCamera(focus);
  }, [focus]);
  useEffect(() => {
    engine.current?.setMotion(reduced);
  }, [reduced]);
  useEffect(() => {
    engine.current?.setTier(tier);
  }, [tier]);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const pointerFrame = useRef(0);
  useEffect(() => () => cancelAnimationFrame(pointerFrame.current), []);
  return (
    <canvas
      ref={canvas}
      className="topo-canvas"
      aria-hidden="true"
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, y: e.clientY };
      }}
      onPointerMove={(e) => {
        if (drag.current && e.buttons === 1) {
          engine.current?.nudge(
            (e.clientX - drag.current.x) * 0.005,
            (e.clientY - drag.current.y) * 0.003,
          );
          drag.current = { x: e.clientX, y: e.clientY };
        } else if (!pointerFrame.current) {
          const x = e.clientX,
            y = e.clientY;
          pointerFrame.current = requestAnimationFrame(() => {
            pointerFrame.current = 0;
            onHover(engine.current?.pick(x, y) ?? null);
          });
        }
      }}
      onPointerLeave={() => onHover(null)}
      onClick={(e) => {
        const id = engine.current?.pick(e.clientX, e.clientY);
        if (id) onNode(id);
      }}
      onPointerUp={() => {
        drag.current = null;
      }}
    />
  );
}
