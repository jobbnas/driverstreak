import * as THREE from 'three';
import type { Pose } from '@/engine/parking/types';

export type MirrorId = 'inner' | 'left' | 'right' | 'rear';

interface Mirror {
  id: MirrorId;
  target: THREE.WebGLRenderTarget;
  camera: THREE.PerspectiveCamera;
  quad: THREE.Mesh;
}

/**
 * Renders mirror views into textures and composites them as HUD quads
 * (overlay orthographic scene drawn after the main pass).
 */
export class MirrorRig {
  readonly overlay = new THREE.Scene();
  readonly overlayCam = new THREE.OrthographicCamera(0, 1, 1, 0, -1, 1);
  private mirrors: Mirror[] = [];
  private frames: THREE.Mesh[] = [];
  private guide: THREE.Group;
  showRear = false;

  constructor() {
    const mk = (id: MirrorId, w: number, h: number, fov: number): Mirror => {
      const target = new THREE.WebGLRenderTarget(w, h, { samples: 2 });
      const camera = new THREE.PerspectiveCamera(fov, w / h, 0.2, 120);
      // mirror image: flip x
      camera.projectionMatrix.scale(new THREE.Vector3(-1, 1, 1));
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: target.texture }));
      this.overlay.add(quad);
      return { id, target, camera, quad };
    };
    this.mirrors = [mk('inner', 512, 180, 26), mk('left', 320, 220, 24), mk('right', 320, 220, 24), mk('rear', 480, 300, 100)];
    for (const m of this.mirrors) {
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x111111 }));
      frame.position.z = -0.1;
      this.overlay.add(frame);
      this.frames.push(frame);
    }
    // backkamera distance guide lines (overlay on the rear quad)
    this.guide = new THREE.Group();
    const cols = [0xef4444, 0xf5b942, 0x5dc98f];
    for (let i = 0; i < 3; i++) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.012), new THREE.MeshBasicMaterial({ color: cols[i], transparent: true, opacity: 0.85 }));
      line.position.z = 0.1;
      this.guide.add(line);
    }
    this.overlay.add(this.guide);
  }

  /** Lay out quads in normalised screen coordinates (0..1) for the given css size. */
  layout(w: number, h: number): void {
    this.overlayCam.right = w;
    this.overlayCam.top = h;
    this.overlayCam.updateProjectionMatrix();
    const place = (m: Mirror | undefined, x: number, y: number, qw: number, qh: number, visible: boolean) => {
      if (!m) return;
      m.quad.visible = visible;
      const frame = this.frames[this.mirrors.indexOf(m)] as THREE.Mesh;
      frame.visible = visible;
      m.quad.scale.set(qw, qh, 1);
      m.quad.position.set(x + qw / 2, y + qh / 2, 0);
      frame.scale.set(qw + 8, qh + 8, 1);
      frame.position.set(x + qw / 2, y + qh / 2, -0.1);
    };
    const innerW = Math.min(w * 0.3, 300);
    const innerH = innerW * 0.35;
    place(this.mirrors[0], (w - innerW) / 2, h - innerH - 150, innerW, innerH, true);
    const sideW = Math.min(w * 0.2, 170);
    const sideH = sideW * 0.68;
    place(this.mirrors[1], 10, h * 0.4 - sideH, sideW, sideH, true);
    place(this.mirrors[2], w - sideW - 10, h * 0.4 - sideH, sideW, sideH, true);
    const rearW = Math.min(w * 0.42, 360);
    const rearH = rearW * 0.62;
    place(this.mirrors[3], (w - rearW) / 2, 24, rearW, rearH, this.showRear);
    this.guide.visible = this.showRear;
    const ys = [0.22, 0.42, 0.62];
    this.guide.children.forEach((c, i) => {
      const line = c as THREE.Mesh;
      line.scale.set(rearW * (0.5 + i * 0.12), 1, 1);
      line.position.set(w / 2, 24 + rearH * (ys[i] as number), 0.1);
    });
  }

  /** Position the mirror cameras on the car. */
  update(pose: Pose): void {
    const h = pose.heading;
    const fx = Math.cos(h);
    const fz = -Math.sin(h);
    const lx = -fz; // left in world
    const lz = fx;
    const car = new THREE.Vector3(pose.x, 0, -pose.y);
    const back = new THREE.Vector3(-fx, 0, -fz);
    const set = (m: Mirror, offF: number, offL: number, up: number, yawOffset: number, pitch: number) => {
      const pos = car.clone().add(new THREE.Vector3(fx * offF + lx * offL, up, fz * offF + lz * offL));
      const yaw = h + Math.PI + yawOffset;
      const dir = new THREE.Vector3(Math.cos(yaw), pitch, -Math.sin(yaw));
      m.camera.position.copy(pos);
      m.camera.up.set(0, 1, 0);
      m.camera.lookAt(pos.clone().add(dir));
    };
    set(this.mirrors[0] as Mirror, 1.9, 0, 1.25, 0, -0.05);
    set(this.mirrors[1] as Mirror, 2.2, 1.0, 1.0, 0.33, -0.1);
    set(this.mirrors[2] as Mirror, 2.2, -1.0, 1.0, -0.33, -0.1);
    const rear = this.mirrors[3] as Mirror;
    rear.camera.position.copy(car.clone().add(back.clone().multiplyScalar(1.15)).add(new THREE.Vector3(0, 0.75, 0)));
    rear.camera.up.set(0, 1, 0);
    rear.camera.lookAt(rear.camera.position.clone().add(back).add(new THREE.Vector3(0, -0.45, 0)));
  }

  render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, hideCarInterior?: THREE.Object3D): void {
    const prevFog = scene.fog;
    for (const m of this.mirrors) {
      if (!m.quad.visible) continue;
      if (hideCarInterior) hideCarInterior.visible = false;
      renderer.setRenderTarget(m.target);
      // camera projection was scaled once; three re-derives it on updateProjectionMatrix, so re-apply
      m.camera.updateProjectionMatrix();
      m.camera.projectionMatrix.scale(new THREE.Vector3(m.id === 'rear' ? 1 : -1, 1, 1));
      renderer.render(scene, m.camera);
      if (hideCarInterior) hideCarInterior.visible = true;
    }
    renderer.setRenderTarget(null);
    scene.fog = prevFog;
  }

  renderOverlay(renderer: THREE.WebGLRenderer): void {
    renderer.autoClear = false;
    renderer.clearDepth();
    renderer.render(this.overlay, this.overlayCam);
    renderer.autoClear = true;
  }

  dispose(): void {
    for (const m of this.mirrors) m.target.dispose();
  }
}
