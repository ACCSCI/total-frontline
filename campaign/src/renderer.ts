import * as THREE from 'three';
import { WebGPURenderer } from 'three/webgpu';

export type RendererBackend = 'webgpu' | 'webgl2';

export interface GameRenderer {
  backend: RendererBackend;
  instance: THREE.WebGLRenderer;
  setSize(width: number, height: number): void;
  setPixelRatio(ratio: number): void;
  render(scene: THREE.Scene, camera: THREE.Camera): void;
  setAnimationLoop(callback: ((time: number) => void) | null): Promise<void> | void;
}

function timeout(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Renderer init timed out after ${ms}ms`)), ms);
  });
}

export async function createRenderer(canvas: HTMLCanvasElement): Promise<GameRenderer> {
  const statusEl = document.getElementById('rendererBadge');
  const setStatus = (text: string) => {
    if (statusEl) statusEl.textContent = `RENDERER: ${text}`;
  };

  const forceFallback = new URLSearchParams(location.search).get('renderer') === 'webgl2';

  if (!forceFallback && (navigator as unknown as { gpu?: unknown }).gpu) {
    try {
      setStatus('WEBGPU INITIALIZING…');
      const renderer = new WebGPURenderer({
        canvas,
        antialias: true,
      });
      await Promise.race([renderer.init(), timeout(7000)]);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.setSize(innerWidth, innerHeight);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 2.2;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      setStatus('WEBGPU');
      return {
        backend: 'webgpu',
        instance: renderer as unknown as THREE.WebGLRenderer,
        setSize: (w, h) => renderer.setSize(w, h),
        setPixelRatio: (r) => renderer.setPixelRatio(r),
        render: (scene, camera) => renderer.render(scene, camera),
        setAnimationLoop: (cb) => renderer.setAnimationLoop(cb),
      };
    } catch (error) {
      console.warn('[P0] WebGPU init failed, falling back to WebGL2.', error);
      setStatus('WEBGPU FAILED → WEBGL2');
    }
  } else {
    setStatus('WEBGPU UNAVAILABLE → WEBGL2');
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.55;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return {
    backend: 'webgl2',
    instance: renderer,
    setSize: (w, h) => renderer.setSize(w, h),
    setPixelRatio: (r) => renderer.setPixelRatio(r),
    render: (scene, camera) => renderer.render(scene, camera),
    setAnimationLoop: (cb) => renderer.setAnimationLoop(cb),
  };
}
