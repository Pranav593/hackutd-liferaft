"use client";

import { useEffect, useRef, useState } from "react";

type P = { hx: number; hy: number; x: number; y: number; vx: number; vy: number; s: number; heat: number };

/**
 * The hero wordmark, drawn as a field of ink specks. The specks gather into the
 * word on load and scatter (and warm up) around the pointer. Purely decorative:
 * the real heading is the visually hidden <h1> next to it.
 */
export function HeroStipple({ text }: { text: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const el = wrap.current;
    const cv = canvas.current;
    const ctx = cv?.getContext("2d");
    if (!el || !cv || !ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let parts: P[] = [];
    let W = 0;
    let H = 0;
    let raf = 0;
    let alive = true;
    let shown = false;
    const mouse = { x: -1e4, y: -1e4, on: false };
    const css = getComputedStyle(cv);
    const ink = css.getPropertyValue("--ink").trim() || "#0f0f0e";
    const hot = css.getPropertyValue("--accent").trim() || "#ff4a1c";
    const probe = document.createElement("span");
    probe.style.fontFamily = "var(--font-instrument), Georgia, serif";
    el.appendChild(probe);
    const family = getComputedStyle(probe).fontFamily;
    probe.remove();

    const build = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      W = el.clientWidth;
      H = Math.round(Math.min(W * 0.3, 420));
      cv.width = W * dpr;
      cv.height = H * dpr;
      cv.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const o = off.getContext("2d", { willReadFrequently: true });
      if (!o || W < 10) return;
      o.font = `400 100px ${family}`;
      const fit = (100 * W * 0.985) / Math.max(1, o.measureText(text).width);
      const size = Math.min(fit, H * 1.18);
      o.font = `400 ${size}px ${family}`;
      o.textBaseline = "alphabetic";
      o.fillText(text, (W - o.measureText(text).width) / 2, H * 0.8);
      const data = o.getImageData(0, 0, W, H).data;
      const step = Math.max(2.6, W / 340);
      const next: P[] = [];
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          const jx = x + (Math.random() - 0.5) * step;
          const jy = y + (Math.random() - 0.5) * step;
          const ix = Math.min(W - 1, Math.max(0, jx | 0));
          const iy = Math.min(H - 1, Math.max(0, jy | 0));
          if (data[(iy * W + ix) * 4 + 3] < 140) continue;
          const start = reduce ? { x: jx, y: jy } : { x: Math.random() * W, y: H + Math.random() * H * 0.6 };
          next.push({ hx: jx, hy: jy, ...start, vx: 0, vy: 0, s: step * (0.32 + Math.random() * 0.34), heat: 0 });
        }
      }
      parts = next;
      kick();
    };

    const frame = () => {
      raf = 0;
      if (!alive) return;
      ctx.clearRect(0, 0, W, H);
      const R = Math.max(70, W * 0.08);
      let moving = false;
      const hotOnes: P[] = [];
      ctx.fillStyle = ink;
      for (const p of parts) {
        if (mouse.on) {
          const dx = p.x - mouse.x;
          const dy = p.y - mouse.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < R * R) {
            const d = Math.sqrt(d2) || 1;
            const f = (1 - d / R) * 2.4;
            p.vx += (dx / d) * f;
            p.vy += (dy / d) * f;
            p.heat = Math.min(1, p.heat + 0.2);
          }
        }
        p.vx = (p.vx + (p.hx - p.x) * 0.06) * 0.8;
        p.vy = (p.vy + (p.hy - p.y) * 0.06) * 0.8;
        p.x += p.vx;
        p.y += p.vy;
        p.heat *= 0.95;
        if (Math.abs(p.vx) + Math.abs(p.vy) > 0.04 || Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y) > 0.3 || p.heat > 0.02) moving = true;
        if (p.heat > 0.25) hotOnes.push(p);
        else ctx.fillRect(p.x, p.y, p.s, p.s);
      }
      ctx.fillStyle = hot;
      for (const p of hotOnes) ctx.fillRect(p.x, p.y, p.s * 1.15, p.s * 1.15);
      if (!shown && parts.length) {
        shown = true;
        setDrawn(true);
      }
      if (moving || mouse.on) kick();
    };
    const kick = () => {
      if (!raf && alive) raf = requestAnimationFrame(frame);
    };

    const move = (e: PointerEvent) => {
      if (reduce) return;
      const r = cv.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
      mouse.on = true;
      kick();
    };
    const leave = () => {
      mouse.on = false;
      mouse.x = mouse.y = -1e4;
      kick();
    };
    cv.addEventListener("pointermove", move);
    cv.addEventListener("pointerleave", leave);

    let t: ReturnType<typeof setTimeout>;
    const ro = new ResizeObserver(() => {
      clearTimeout(t);
      t = setTimeout(build, 120);
    });
    document.fonts.load(`400 100px ${family}`).catch(() => undefined).finally(() => {
      if (!alive) return;
      build();
      ro.observe(el);
    });
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      clearTimeout(t);
      ro.disconnect();
      cv.removeEventListener("pointermove", move);
      cv.removeEventListener("pointerleave", leave);
    };
  }, [text]);

  return (
    <div ref={wrap} className={`stipple ${drawn ? "drawn" : ""}`} aria-hidden>
      <canvas ref={canvas} />
      <span className="stipple-fallback">{text}</span>
    </div>
  );
}
