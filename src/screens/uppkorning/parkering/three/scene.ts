import * as THREE from 'three';

export const SKY = 0x9fc5e8;

/** Engine (x, y, heading) -> three (x, 0, -y, rotation.y = heading). */
export function toWorld(x: number, y: number, h = 0): THREE.Vector3 {
  return new THREE.Vector3(x, h, -y);
}

export class SceneHost {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly sun: THREE.DirectionalLight;
  private maxDpr = 2;
  private fpsLow = 0;
  private lastFrame = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setClearColor(SKY);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.fog = new THREE.Fog(SKY, 60, 140);
    const hemi = new THREE.HemisphereLight(0xdde8ff, 0x55606a, 0.9);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 1.6);
    this.sun.position.set(-18, 30, 14);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.near = 1;
    this.sun.shadow.camera.far = 120;
    this.sun.shadow.bias = -0.0005;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
  }

  /** Keep the shadow frustum around the car for crisp shadows. */
  focusShadow(x: number, z: number, radius = 22): void {
    const c = this.sun.shadow.camera;
    this.sun.position.set(x - 18, 30, z + 14);
    this.sun.target.position.set(x, 0, z);
    c.left = -radius;
    c.right = radius;
    c.top = radius;
    c.bottom = -radius;
    c.updateProjectionMatrix();
  }

  resize(cssW: number, cssH: number): void {
    const dpr = Math.min(window.devicePixelRatio || 1, this.maxDpr);
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(cssW, cssH, false);
  }

  /** Adaptive DPR: drop to 1.5 when frames are consistently slow. */
  noteFrame(now: number, cssW: number, cssH: number): void {
    if (this.lastFrame) {
      const dt = now - this.lastFrame;
      if (dt > 24) this.fpsLow += dt;
      else this.fpsLow = Math.max(0, this.fpsLow - dt * 0.5);
      if (this.fpsLow > 2000 && this.maxDpr > 1.25) {
        this.maxDpr = 1.25;
        this.resize(cssW, cssH);
        this.fpsLow = 0;
      }
    }
    this.lastFrame = now;
  }

  dispose(): void {
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
      else mat?.dispose();
    });
    this.renderer.dispose();
  }
}
