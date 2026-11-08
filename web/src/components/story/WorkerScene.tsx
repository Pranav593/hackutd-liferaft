"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

export default function WorkerScene({
  transferred,
  warning,
  playing,
}: {
  transferred: boolean;
  warning: boolean;
  playing: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const container = host.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      setFailed(true);
      return;
    }
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    camera.position.set(0, 4.5, 9);
    camera.lookAt(0, 0, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);
    scene.add(new THREE.AmbientLight(0xb6d9ff, 2));
    const light = new THREE.DirectionalLight(0xffffff, 4);
    light.position.set(1, 6, 4);
    scene.add(light);
    const colors = [warning ? 0xffb95c : 0x66a9ff, 0x6ce8c3, 0x7f8bb5];
    const positions = [
      new THREE.Vector3(-2.65, 0, 0),
      new THREE.Vector3(2.65, 0, 0),
      new THREE.Vector3(0, 0, -2.3),
    ];
    positions.forEach((position, i) => {
      const group = new THREE.Group();
      group.position.copy(position);
      for (let n = 0; n < 4; n++) {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(1.25, 0.24, 0.9),
          new THREE.MeshStandardMaterial({
            color: 0x192642,
            metalness: 0.6,
            roughness: 0.3,
            emissive: colors[i],
            emissiveIntensity: 0.08,
          }),
        );
        mesh.position.y = n * 0.3;
        group.add(mesh);
        const led = new THREE.Mesh(
          new THREE.BoxGeometry(0.43, 0.025, 0.02),
          new THREE.MeshBasicMaterial({ color: colors[i] }),
        );
        led.position.set(-0.22, n * 0.3, 0.46);
        group.add(led);
      }
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.97, 0.012, 8, 64),
        new THREE.MeshBasicMaterial({ color: colors[i] }),
      );
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = -0.2;
      group.add(ring);
      scene.add(group);
    });
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-2.65, 1.15, 0),
      new THREE.Vector3(0, 3, -0.3),
      new THREE.Vector3(2.65, 1.15, 0),
    );
    scene.add(
      new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(curve.getPoints(80)),
        new THREE.LineBasicMaterial({
          color: transferred ? 0x6ce8c3 : 0x445a7c,
          transparent: true,
          opacity: 0.7,
        }),
      ),
    );
    const pulse = new THREE.Mesh(
      new THREE.SphereGeometry(0.105, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xc9fff0 }),
    );
    pulse.position.copy(curve.getPoint(transferred ? 1 : 0));
    scene.add(pulse);
    if (transferred) {
      const fence = new THREE.Mesh(
        new THREE.PlaneGeometry(0.04, 2.1),
        new THREE.MeshBasicMaterial({
          color: 0x6ce8c3,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.7,
        }),
      );
      fence.position.set(-1.25, 0.9, 0.15);
      scene.add(fence);
    }
    const grid = new THREE.GridHelper(14, 24, 0x24334d, 0x142039);
    grid.position.y = -0.3;
    scene.add(grid);
    const resize = () => {
      const w = container.clientWidth,
        h = container.clientHeight;
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (!renderer.getContext().isContextLost())
        renderer.render(scene, camera);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let frame = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const started = performance.now();
    function animate(now: number) {
      const progress = Math.min((now - started) / 2200, 1);
      pulse.position.copy(curve.getPoint(progress));
      if (!renderer.getContext().isContextLost())
        renderer.render(scene, camera);
      if (progress < 1) frame = requestAnimationFrame(animate);
    }
    if (transferred && playing && !reduced)
      frame = requestAnimationFrame(animate);
    const lost = (event: Event) => {
      event.preventDefault();
      setFailed(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", lost);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [transferred, warning, playing]);
  return (
    <div
      className="story-scene"
      ref={host}
      role="img"
      aria-label={`Same-host worker topology. ${transferred ? "Epoch transferred to standby" : "Primary training; standby registered"}`}
    >
      {failed ? (
        <div className="story-scene-fallback">
          PRIMARY ─── verified checkpoint ─── STANDBY
          <br />
          {transferred
            ? "Epoch 2 · old owner fenced"
            : "Epoch 1 · awaiting handoff"}
        </div>
      ) : null}
    </div>
  );
}
