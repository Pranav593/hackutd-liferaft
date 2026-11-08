import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  BoxGeometry,
  IcosahedronGeometry,
  TorusGeometry,
  MeshStandardMaterial,
  MeshBasicMaterial,
  EdgesGeometry,
  LineSegments,
  LineBasicMaterial,
  HemisphereLight,
  DirectionalLight,
  PointLight,
  BufferGeometry,
  Vector3,
  Line,
  CatmullRomCurve3,
  SphereGeometry,
  InstancedMesh,
  Matrix4,
  GridHelper,
  DataTexture,
  PlaneGeometry,
  RGBAFormat,
  Quaternion,
  Raycaster,
  Vector2,
} from "three";
import {
  positions,
  type NodeId,
  type TopologyFrame,
} from "../../../lib/derive/topology-frame";
export type Tier = "high" | "mid" | "low";
type Disposable = { dispose: () => void };
export class TopologyEngine {
  renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(34, 1, 0.1, 100);
  private resources = new Set<Disposable>();
  private groups = new Map<NodeId, Group>();
  private screens = new Map<NodeId, Group>();
  private raf = 0;
  private dead = false;
  private visible = true;
  private frame: TopologyFrame | null = null;
  private transitionStart = 0;
  private transitionId: string | null = null;
  private packet: InstancedMesh;
  private baton: Mesh;
  private target = new Vector3(0, 4.6, 9.2);
  private look = new Vector3(0, 0.2, 0);
  private currentLook = new Vector3(0, 0.2, 0);
  private lastTime = 0;
  private frames = 0;
  private rendered = 0;
  private average = 0;
  private tier: Tier;
  private rim = new PointLight(0x5ff0d6, 12, 15);
  private observer: ResizeObserver;
  private intersection: IntersectionObserver;
  private reduced = false;
  private selected: NodeId | null = null;
  private raycaster = new Raycaster();
  private bloom: ReturnType<(typeof import("./Bloom"))["createBloom"]> | null =
    null;
  private bloomLoading = false;
  private notches: InstancedMesh;
  private velocity = new Vector3();
  private lookVelocity = new Vector3();
  private label: (id: NodeId, x: number, y: number) => void;
  constructor(
    private canvas: HTMLCanvasElement,
    opts: {
      tier: Tier;
      reduced: boolean;
      label: (id: NodeId, x: number, y: number) => void;
    },
  ) {
    this.tier = opts.tier;
    this.reduced = opts.reduced;
    this.label = opts.label;
    this.renderer = new WebGLRenderer({
      canvas,
      alpha: true,
      antialias: opts.tier !== "low",
      failIfMajorPerformanceCaveat: true,
      powerPreference: "low-power",
    });
    const gl = this.renderer.getContext(),
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    if (
      debug &&
      /SwiftShader|llvmpipe/i.test(
        gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      )
    ) {
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      throw new Error("Software renderer");
    }
    // The canvas uses screen compositing over the navy stage; black stays transparent visually.
    this.renderer.setClearColor(0x000000, 1);
    this.setTier(opts.tier);
    this.camera.position.copy(this.target);
    this.camera.lookAt(this.look);
    this.scene.add(new HemisphereLight(0x9bb8ff, 0x060b16, 2));
    const key = new DirectionalLight(0xc5ddff, 3);
    key.position.set(-2, 6, 4);
    this.scene.add(key);
    this.rim.position.set(0, 3, 1);
    this.scene.add(this.rim);
    // One instanced draw for all five procedural contact shadows.
    const shadowData = new Uint8Array(32 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 32; x++) {
        const i = (y * 32 + x) * 4;
        shadowData[i + 3] = Math.round(
          Math.max(0, 1 - Math.hypot(x - 15.5, y - 15.5) / 16) ** 2 * 160,
        );
      }
    const texture = this.keep(new DataTexture(shadowData, 32, 32, RGBAFormat));
    texture.needsUpdate = true;
    const shadows = this.keep(
      new InstancedMesh(
        this.keep(new PlaneGeometry(2.5, 1.8)),
        this.keep(
          new MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthWrite: false,
          }),
        ),
        5,
      ),
    );
    Object.values(positions).forEach((p, i) =>
      shadows.setMatrixAt(
        i,
        new Matrix4().compose(
          new Vector3(p[0], -0.37, p[2]),
          new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2),
          new Vector3(1, 1, 1),
        ),
      ),
    );
    this.scene.add(shadows);
    const grid = new GridHelper(12, 24, 0x244b5c, 0x172a43);
    grid.position.y = -0.4;
    this.scene.add(grid);
    this.keep(grid.geometry);
    this.keep(grid.material as LineBasicMaterial);
    for (const id of Object.keys(positions) as NodeId[]) {
      const group = new Group();
      group.position.set(...positions[id]);
      this.groups.set(id, group);
      this.scene.add(group);
      if (id === "coordinator") {
        group.add(this.mesh(new IcosahedronGeometry(0.43, 1), true));
        for (const radius of [0.7, 0.86]) {
          const ring = this.mesh(new TorusGeometry(radius, 0.012, 5, 48), true);
          ring.rotation.x = Math.PI / 2.6;
          group.add(ring);
        }
      } else if (id === "primary" || id === "standby") {
        const base = this.mesh(new BoxGeometry(1.3, 0.08, 0.85));
        group.add(base);
        const lid = new Group();
        lid.position.set(0, 0.08, -0.37);
        lid.rotation.x = -0.15;
        group.add(lid);
        this.screens.set(id, lid);
        const screen = this.mesh(new BoxGeometry(1.3, 0.85, 0.05));
        screen.position.y = 0.42;
        lid.add(screen);
        const glow = this.mesh(new BoxGeometry(1.12, 0.65, 0.015), true);
        glow.position.set(0, 0.44, 0.035);
        lid.add(glow);
      } else {
        group.add(
          this.mesh(new BoxGeometry(id === "pi" ? 1.1 : 0.8, 0.09, 0.7)),
        );
        const chip = this.mesh(new BoxGeometry(0.34, 0.11, 0.3));
        chip.position.y = 0.1;
        group.add(chip);
        const pins = this.keep(
          new InstancedMesh(
            this.keep(new BoxGeometry(0.025, 0.13, 0.025)),
            this.keep(new MeshBasicMaterial({ color: 0x5ff0d6 })),
            8,
          ),
        );
        for (let j = 0; j < 8; j++)
          pins.setMatrixAt(
            j,
            new Matrix4().makeTranslation(-0.4 + j * 0.11, 0.1, 0.26),
          );
        group.add(pins);
        if (id === "esp32") {
          const oled = this.mesh(new BoxGeometry(0.42, 0.03, 0.23), true);
          oled.position.set(0, 0.15, -0.16);
          group.add(oled);
        }
      }
      if (id !== "coordinator") {
        const a = new Vector3(...positions[id]),
          b = new Vector3(...positions.coordinator),
          mid = a.clone().lerp(b, 0.5);
        mid.y = -0.25;
        const curve = new CatmullRomCurve3([a, mid, b]);
        const geometry = this.keep(
          new BufferGeometry().setFromPoints(curve.getPoints(28)),
        );
        const material = this.keep(
          new LineBasicMaterial({
            color: 0x376477,
            transparent: true,
            opacity: 0.55,
          }),
        );
        this.scene.add(new Line(geometry, material));
      }
    }
    this.packet = new InstancedMesh(
      this.keep(new SphereGeometry(0.065, 8, 6)),
      this.keep(new MeshBasicMaterial({ color: 0x5ff0d6 })),
      8,
    );
    this.keep(this.packet);
    this.packet.count = 0;
    this.scene.add(this.packet);
    this.baton = new Mesh(
      this.keep(new TorusGeometry(0.3, 0.025, 6, 32)),
      this.keep(new MeshBasicMaterial({ color: 0x5ff0d6 })),
    );
    this.baton.visible = false;
    this.scene.add(this.baton);
    this.notches = new InstancedMesh(
      this.keep(new BoxGeometry(0.025, 0.025, 0.09)),
      this.keep(new MeshBasicMaterial({ color: 0x5ff0d6 })),
      32,
    );
    this.keep(this.notches);
    this.notches.count = 0;
    this.scene.add(this.notches);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement!);
    this.intersection = new IntersectionObserver((entries) => {
      this.visible = entries[0].isIntersecting;
      if (this.visible) this.request();
      else this.cancel();
    });
    this.intersection.observe(canvas);
    document.addEventListener("visibilitychange", this.visibility);
    this.resize();
    this.configureBloom();
  }
  private keep<T extends Disposable>(resource: T): T {
    this.resources.add(resource);
    return resource;
  }
  private mesh(
    geometry: BoxGeometry | IcosahedronGeometry | TorusGeometry,
    glow = false,
  ) {
    this.keep(geometry);
    const material = this.keep(
      new MeshStandardMaterial({
        color: glow ? 0x2d8f8a : 0x162b47,
        emissive: glow ? 0x236d68 : 0x000000,
        emissiveIntensity: glow ? 0.7 : 0,
        roughness: 0.35,
        metalness: 0.1,
      }),
    );
    const mesh = new Mesh(geometry, material);
    if (!glow)
      material.onBeforeCompile = (shader) => {
        shader.vertexShader =
          "varying vec3 vRaftNormal; varying vec3 vRaftView;\n" +
          shader.vertexShader;
        shader.vertexShader = shader.vertexShader.replace(
          "#include <project_vertex>",
          "#include <project_vertex>\nvRaftNormal=normalize(normalMatrix*objectNormal); vRaftView=normalize(-mvPosition.xyz);",
        );
        shader.fragmentShader =
          "varying vec3 vRaftNormal; varying vec3 vRaftView;\n" +
          shader.fragmentShader;
        shader.fragmentShader = shader.fragmentShader.replace(
          "#include <dithering_fragment>",
          "#include <dithering_fragment>\ngl_FragColor.rgb += pow(1.0-abs(dot(normalize(vRaftNormal),normalize(vRaftView))),3.0)*vec3(0.03,0.14,0.15);",
        );
      };
    const edgeGeometry = this.keep(new EdgesGeometry(geometry)),
      edgeMaterial = this.keep(
        new LineBasicMaterial({
          color: 0x5ff0d6,
          transparent: true,
          opacity: 0.4,
        }),
      );
    mesh.add(new LineSegments(edgeGeometry, edgeMaterial));
    return mesh;
  }
  private visibility = () => {
    if (document.hidden) this.cancel();
    else this.request();
  };
  private cancel() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastTime = 0;
  }
  private resize() {
    if (this.dead) return;
    const { width, height } = this.canvas.getBoundingClientRect();
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.bloom?.resize(width, height);
    this.request();
  }
  setTier(tier: Tier) {
    this.tier = tier;
    this.renderer.setPixelRatio(
      Math.min(
        window.devicePixelRatio || 1,
        tier === "high" ? 2 : tier === "mid" ? 1.5 : 1,
      ),
    );
    if (this.observer) this.resize();
    this.configureBloom();
  }
  private configureBloom() {
    if (this.tier !== "high") {
      this.bloom?.dispose();
      this.bloom = null;
      return;
    }
    if (this.bloom || this.bloomLoading) return;
    this.bloomLoading = true;
    void import("./Bloom")
      .then(({ createBloom }) => {
        this.bloomLoading = false;
        if (this.dead || this.tier !== "high") return;
        this.bloom = createBloom(this.renderer, this.scene, this.camera);
        this.resize();
      })
      .catch(() => {
        this.bloomLoading = false;
      });
  }
  setMotion(reduced: boolean) {
    this.reduced = reduced;
    if (reduced) {
      this.transitionId = null;
      this.packet.count = 0;
      this.baton.visible = false;
    }
    this.request();
  }
  setFrame(frame: TopologyFrame) {
    this.frame = frame;
    this.notches.count = Math.min(32, frame.epoch ?? 0);
    for (let i = 0; i < this.notches.count; i++) {
      const angle = (i / Math.max(1, this.notches.count)) * Math.PI * 2;
      this.notches.setMatrixAt(
        i,
        new Matrix4().makeTranslation(
          Math.cos(angle) * 0.7,
          0.23,
          Math.sin(angle) * 0.7,
        ),
      );
    }
    this.notches.instanceMatrix.needsUpdate = true;
    for (const n of frame.nodes) {
      const g = this.groups.get(n.id)!;
      g.traverse((o) => {
        if (o instanceof InstancedMesh) {
          (o.material as MeshBasicMaterial).color.setHex(
            n.seen ? 0x5ff0d6 : 0x62779c,
          );
        }
        if (o instanceof LineSegments) {
          const line = o.material as LineBasicMaterial;
          line.color.setHex(n.seen ? 0x5ff0d6 : 0x62779c);
          line.opacity = n.seen ? 0.4 : 0.2;
        }
        if (o instanceof Mesh && !(o instanceof InstancedMesh)) {
          const m = o.material as MeshStandardMaterial;
          m.color.setHex(n.seen ? (n.active ? 0x287d78 : 0x162b47) : 0x152036);
        }
      });
      const lid = this.screens.get(n.id);
      if (lid) lid.rotation.x = n.active ? -0.17 : 0.35;
    }
    if (
      frame.transition &&
      frame.transition.eventId !== this.transitionId &&
      !this.reduced
    ) {
      this.transitionId = frame.transition.eventId;
      this.transitionStart = performance.now();
    } else if (!frame.transition) {
      this.transitionId = null;
      this.packet.count = 0;
      this.baton.visible = false;
    }
    this.request();
  }
  setCamera(node: NodeId | null) {
    this.selected = node;
    const pos = node ? new Vector3(...positions[node]) : new Vector3(0, 0.2, 0);
    this.look.copy(pos);
    this.target.copy(
      node
        ? pos.clone().add(new Vector3(0, 2.7, 5.8))
        : new Vector3(0, 4.6, 9.2),
    );
    this.request();
  }
  nudge(dx: number, dy: number) {
    this.target.x = Math.max(-2.8, Math.min(2.8, this.target.x + dx));
    this.target.y = Math.max(4, Math.min(6, this.target.y + dy));
    this.request();
  }
  pick(clientX: number, clientY: number): NodeId | null {
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(
      new Vector2(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        (-(clientY - rect.top) / rect.height) * 2 + 1,
      ),
      this.camera,
    );
    const hit = this.raycaster.intersectObjects(
      [...this.groups.values()],
      true,
    )[0];
    if (!hit) return null;
    for (const [id, group] of this.groups) {
      let object = hit.object;
      while (object.parent) {
        if (object === group) return id;
        object = object.parent;
      }
    }
    return null;
  }
  private request() {
    if (!this.dead && !this.raf && this.visible && !document.hidden)
      this.raf = requestAnimationFrame(this.render);
  }
  private render = (now: number) => {
    this.raf = 0;
    if (this.dead) return;
    const start = performance.now(),
      dt = this.lastTime
        ? Math.min(0.05, (now - this.lastTime) / 1000)
        : 1 / 60;
    this.lastTime = now;
    // Analytic critically damped spring; no overshoot, stable across frame gaps.
    const spring = (value: Vector3, target: Vector3, velocity: Vector3) => {
      if (this.reduced) {
        value.copy(target);
        velocity.set(0, 0, 0);
        return;
      }
      const offset = value.clone().sub(target),
        term = velocity.clone().addScaledVector(offset, 12),
        decay = Math.exp(-12 * dt);
      value
        .copy(target)
        .add(offset.addScaledVector(term, dt).multiplyScalar(decay));
      velocity.addScaledVector(term, -12 * dt).multiplyScalar(decay);
    };
    spring(this.camera.position, this.target, this.velocity);
    spring(this.currentLook, this.look, this.lookVelocity);
    this.camera.lookAt(this.currentLook);
    const focus = this.selected
      ? new Vector3(...positions[this.selected])
      : new Vector3(0, 1, 1);
    this.rim.position.copy(focus.add(new Vector3(0, 2, 1)));
    let moving =
      this.camera.position.distanceTo(this.target) > 0.002 ||
      this.currentLook.distanceTo(this.look) > 0.002;
    const t = this.frame?.transition;
    if (t && this.transitionId === t.eventId && !this.reduced) {
      const progress = Math.min(1, (now - this.transitionStart) / 1200);
      const a = new Vector3(...positions[t.from]),
        b = new Vector3(...positions[t.to]);
      const mid =
        t.kind === "baton"
          ? new Vector3(0, 0.8, 0)
          : a
              .clone()
              .lerp(b, 0.5)
              .add(new Vector3(0, 0.6, 0));
      const path = new CatmullRomCurve3([a, mid, b]);
      const p = path.getPoint(progress * progress * (3 - 2 * progress));
      const color = t.source === "injected" ? 0xffb84d : 0x5ff0d6;
      (this.packet.material as MeshBasicMaterial).color.setHex(color);
      (this.baton.material as MeshBasicMaterial).color.setHex(color);
      if (progress < 1) {
        moving = true;
        if (t.kind === "packet" || t.kind === "signal") {
          this.packet.count = 1;
          this.packet.setMatrixAt(
            0,
            new Matrix4().makeTranslation(p.x, p.y + 0.2, p.z),
          );
          this.packet.instanceMatrix.needsUpdate = true;
        } else {
          this.baton.visible = true;
          this.baton.position.copy(p);
          this.baton.rotation.x = Math.PI / 2;
          this.baton.scale.setScalar(
            t.kind === "halo" ? 1 + progress * 1.5 : 1,
          );
        }
      } else {
        this.packet.count = 0;
        this.baton.visible = false;
      }
    }
    if (this.bloom) this.bloom.render();
    else this.renderer.render(this.scene, this.camera);
    this.rendered++;
    if (this.canvas.dataset) {
      this.canvas.dataset.renderCount = String(this.rendered);
      this.canvas.dataset.gpuGeometries = String(
        this.renderer.info.memory.geometries,
      );
      this.canvas.dataset.gpuTextures = String(
        this.renderer.info.memory.textures,
      );
      this.canvas.dataset.drawCalls = String(this.renderer.info.render.calls);
      this.canvas.dataset.triangles = String(
        this.renderer.info.render.triangles,
      );
    }
    for (const [id, group] of this.groups) {
      const p = group.position
        .clone()
        .add(new Vector3(0, 1.1, 0))
        .project(this.camera);
      this.label(id, (p.x * 0.5 + 0.5) * 100, (-p.y * 0.5 + 0.5) * 100);
    }
    const elapsed = performance.now() - start;
    this.average = this.average
      ? this.average * 0.95 + elapsed * 0.05
      : elapsed;
    this.frames++;
    if (this.frames >= 60 && this.average > 22 && this.tier !== "low") {
      this.setTier(this.tier === "high" ? "mid" : "low");
      this.frames = 0;
    }
    if (moving) this.request();
    else this.lastTime = 0;
  };
  dispose(loseContext = true) {
    if (this.dead) return;
    this.dead = true;
    this.cancel();
    this.observer.disconnect();
    this.intersection.disconnect();
    document.removeEventListener("visibilitychange", this.visibility);
    this.resources.forEach((r) => r.dispose());
    this.resources.clear();
    this.bloom?.dispose();
    this.bloom = null;
    this.scene.clear();
    this.renderer.dispose();
    if (loseContext) this.renderer.forceContextLoss();
    return { ...this.renderer.info.memory };
  }
}
