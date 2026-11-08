import { Vector2, type WebGLRenderer, type Scene, type Camera } from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

export function createBloom(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
) {
  const composer = new EffectComposer(renderer);
  const render = new RenderPass(scene, camera);
  const bloom = new UnrealBloomPass(new Vector2(512, 256), 0.35, 0.6, 0.8);
  composer.addPass(render);
  composer.addPass(bloom);
  return {
    render: () => composer.render(),
    resize: (width: number, height: number) => {
      composer.setSize(width, height);
      bloom.resolution.set(width / 2, height / 2);
    },
    dispose: () => {
      render.dispose();
      bloom.dispose();
      composer.dispose();
    },
  };
}
