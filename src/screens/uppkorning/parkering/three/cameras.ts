import * as THREE from 'three';
import type { Pose } from '@/engine/parking/types';
import { DEFAULT_CAR } from '@/engine/parking/car';

export type View = 'driver' | 'chase' | 'top';

export class CameraRig {
  readonly persp = new THREE.PerspectiveCamera(60, 1, 0.05, 300);
  readonly ortho = new THREE.OrthographicCamera(-7, 7, 7, -7, 0.1, 100);
  view: View = 'chase';
  lookBack = false;
  glance: -1 | 0 | 1 = 0;
  overview = false;
  private chasePos = new THREE.Vector3();
  private chaseLook = new THREE.Vector3();
  private initialised = false;
  shake = 0;

  get active(): THREE.Camera {
    return this.view === 'top' ? this.ortho : this.persp;
  }

  setAspect(aspect: number): void {
    this.persp.aspect = aspect;
    this.persp.updateProjectionMatrix();
    const halfH = this.overview ? 22 : 8;
    this.ortho.left = -halfH * aspect;
    this.ortho.right = halfH * aspect;
    this.ortho.top = halfH;
    this.ortho.bottom = -halfH;
    this.ortho.updateProjectionMatrix();
  }

  update(pose: Pose, speed: number, dt: number, worldCentre: { x: number; y: number }, aspect: number): void {
    const h = pose.heading;
    const fx = Math.cos(h);
    const fz = -Math.sin(h);
    const car = new THREE.Vector3(pose.x, 0, -pose.y);
    const shakeX = this.shake > 0 ? (Math.random() - 0.5) * 0.06 * this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 6);

    if (this.view === 'top') {
      this.setAspect(aspect);
      const c = this.overview ? new THREE.Vector3(worldCentre.x, 0, -worldCentre.y) : car.clone().add(new THREE.Vector3(fx * 1.2, 0, fz * 1.2));
      this.ortho.position.set(c.x, 60, c.z);
      this.ortho.up.set(0, 0, -1);
      this.ortho.lookAt(c.x, 0, c.z);
      return;
    }

    if (this.view === 'driver') {
      this.persp.fov = this.overview ? 90 : 68;
      this.persp.updateProjectionMatrix();
      const eye = car.clone().add(new THREE.Vector3(fx * 2.0, 1.15, fz * 2.0)).add(new THREE.Vector3(-fz * 0.37, 0, fx * 0.37)); // 0.37 m left
      let yaw = h;
      if (this.lookBack) yaw = h + Math.PI * 0.82;
      else if (this.glance !== 0) yaw = h + this.glance * 0.9;
      const dir = new THREE.Vector3(Math.cos(yaw), -0.12, -Math.sin(yaw));
      this.persp.position.copy(eye).add(new THREE.Vector3(shakeX, shakeX, 0));
      this.persp.up.set(0, 1, 0);
      this.persp.lookAt(eye.clone().add(dir));
      return;
    }

    // chase
    this.persp.fov = this.overview ? 75 : 55;
    this.persp.updateProjectionMatrix();
    const behind = speed < -0.05 ? -1 : 1; // when reversing, look from the front so the rear is visible
    const dist = this.overview ? 16 : 7.5;
    const height = this.overview ? 11 : 3.4;
    const targetPos = car.clone().add(new THREE.Vector3(-fx * dist * behind, height, -fz * dist * behind)).add(new THREE.Vector3(fx * 1.5, 0, fz * 1.5));
    const targetLook = car.clone().add(new THREE.Vector3(fx * 1.5, 0.6, fz * 1.5));
    if (!this.initialised) {
      this.chasePos.copy(targetPos);
      this.chaseLook.copy(targetLook);
      this.initialised = true;
    }
    const k = 1 - Math.exp(-dt / 0.35);
    this.chasePos.lerp(targetPos, k);
    this.chaseLook.lerp(targetLook, k);
    this.persp.position.copy(this.chasePos).add(new THREE.Vector3(shakeX, shakeX, 0));
    this.persp.up.set(0, 1, 0);
    this.persp.lookAt(this.chaseLook);
  }
}
