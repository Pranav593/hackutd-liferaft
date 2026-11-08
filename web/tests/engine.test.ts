import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import type { Scene, BufferGeometry, Material, Texture } from "three";
vi.mock("three", async (importOriginal) => {
  const actual = await importOriginal<typeof import("three")>();
  class Renderer {
    info = {
      memory: { geometries: 0, textures: 0 },
      render: { calls: 0, triangles: 0 },
    };
    forced = false;
    renders = 0;
    disposed = false;
    geometry = new Set<BufferGeometry>();
    textures = new Set<Texture>();
    getContext() {
      return { getExtension: () => null };
    }
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    render(scene: Scene) {
      this.renders++;
      scene.traverse((o) => {
        const object = o as unknown as {
          geometry?: BufferGeometry;
          material?: Material & { map?: Texture };
        };
        const g = object.geometry;
        if (g && !this.geometry.has(g)) {
          this.geometry.add(g);
          this.info.memory.geometries++;
          g.addEventListener("dispose", () => {
            if (this.geometry.delete(g)) this.info.memory.geometries--;
          });
        }
        const t = object.material?.map;
        if (t && !this.textures.has(t)) {
          this.textures.add(t);
          this.info.memory.textures++;
          t.addEventListener("dispose", () => {
            if (this.textures.delete(t)) this.info.memory.textures--;
          });
        }
      });
    }
    dispose() {
      this.disposed = true;
    }
    forceContextLoss() {
      this.forced = true;
    }
  }
  return { ...actual, WebGLRenderer: Renderer };
});
import { TopologyEngine } from "../src/components/topology/engine/TopologyEngine";
import { topologyFrame } from "../src/lib/derive/topology-frame";
import local from "../fixtures/replay.local-job.json";
import type { Replay } from "../src/lib/replay";
let queue = new Map<number, FrameRequestCallback>(),
  next = 0,
  now = 0;
function drain() {
  for (let i = 0; queue.size && i < 300; i++) {
    now += 16;
    const tasks = [...queue.values()];
    queue.clear();
    tasks.forEach((fn) => fn(now));
  }
}
beforeEach(() => {
  queue = new Map();
  next = 0;
  now = 0;
  vi.stubGlobal("window", { devicePixelRatio: 3 });
  vi.stubGlobal("document", {
    hidden: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (fn: FrameRequestCallback) => {
    queue.set(++next, fn);
    return next;
  });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => queue.delete(id));
  vi.spyOn(performance, "now").mockImplementation(() => now);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
const canvas = () =>
  ({
    parentElement: {},
    getBoundingClientRect: () => ({ width: 800, height: 450 }),
  }) as unknown as HTMLCanvasElement;
describe("GPU lifecycle algorithm (instrumented renderer, not physical GPU proof)", () => {
  it("allocates and disposes geometry/texture resources over twenty mounts", () => {
    for (let i = 0; i < 20; i++) {
      const engine = new TopologyEngine(canvas(), {
        tier: "mid",
        reduced: false,
        label: () => {},
      });
      engine.setFrame(topologyFrame(local as Replay, local.events.length - 1));
      drain();
      expect(engine.renderer.info.memory.geometries).toBeGreaterThan(0);
      expect(engine.renderer.info.memory.textures).toBeGreaterThan(0);
      expect(engine.dispose()).toEqual({ geometries: 0, textures: 0 });
      expect(queue.size).toBe(0);
    }
  });
  it("settles the camera and does no GPU work on idle", () => {
    const engine = new TopologyEngine(canvas(), {
      tier: "mid",
      reduced: false,
      label: () => {},
    });
    engine.setCamera("standby");
    drain();
    expect(queue.size).toBe(0);
    engine.dispose();
  });
  it("reduced motion cuts directly to final state in one render", () => {
    const engine = new TopologyEngine(canvas(), {
      tier: "low",
      reduced: true,
      label: () => {},
    });
    const i = local.events.findIndex((e) => e.kind === "LEASE_TRANSFERRED");
    engine.setFrame(topologyFrame(local as Replay, i, i - 1));
    engine.setCamera("standby");
    drain();
    expect(queue.size).toBe(0);
    expect((engine.renderer as unknown as { renders: number }).renders).toBe(1);
    engine.dispose();
  });
  it("can dispose for a restored context without losing it again", () => {
    const engine = new TopologyEngine(canvas(), {
      tier: "mid",
      reduced: false,
      label: () => {},
    });
    drain();
    engine.dispose(false);
    expect((engine.renderer as unknown as { forced: boolean }).forced).toBe(
      false,
    );
  });
});
