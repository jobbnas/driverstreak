import * as THREE from 'three';
import type { CarSpec } from '@/engine/parking/types';
import { bodyCentreOffset } from '@/engine/parking/car';

export interface CarParts {
  group: THREE.Group;
  frontWheels: THREE.Group[];
  wheels: THREE.Mesh[];
  brakeLights: THREE.MeshStandardMaterial;
  reverseLights: THREE.MeshStandardMaterial;
  steeringWheel?: THREE.Group;
}

const glass = new THREE.MeshStandardMaterial({ color: 0x1c2630, roughness: 0.15, metalness: 0.6, transparent: true, opacity: 0.38, side: THREE.DoubleSide, depthWrite: false });
const tyre = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.95 });
const rim = new THREE.MeshStandardMaterial({ color: 0xbfc5cc, roughness: 0.4, metalness: 0.7 });
const dark = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });

/**
 * Procedural car. The group's origin is the rear-axle midpoint on the ground,
 * +x forward (engine heading 0), +y up, -z = engine +y.
 */
export function buildCar(spec: CarSpec, color: string | number, withInterior = false, length = spec.length, width = spec.width): CarParts {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 });
  const cx = bodyCentreOffset({ ...spec, length });
  const bodyH = 0.62;
  const groundClear = 0.2;

  // lower body
  const body = new THREE.Mesh(new THREE.BoxGeometry(length, bodyH, width), paint);
  body.position.set(cx, groundClear + bodyH / 2, 0);
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // cabin (narrower, bevelled with a slanted front/back)
  const cabinL = length * 0.52;
  const cabinH = 0.55;
  const shape = new THREE.Shape();
  shape.moveTo(-cabinL / 2, 0);
  shape.lineTo(cabinL / 2, 0);
  shape.lineTo(cabinL / 2 - 0.55, cabinH);
  shape.lineTo(-cabinL / 2 + 0.35, cabinH);
  shape.lineTo(-cabinL / 2, 0);
  const cabinGeo = new THREE.ExtrudeGeometry(shape, { depth: width * 0.86, bevelEnabled: false });
  cabinGeo.translate(0, 0, -(width * 0.86) / 2);
  const cabin = new THREE.Mesh(cabinGeo, glass);
  cabin.position.set(cx - length * 0.04, groundClear + bodyH, 0);
  cabin.castShadow = true;
  g.add(cabin);
  // roof (painted) on top of the glass
  const roof = new THREE.Mesh(new THREE.BoxGeometry(cabinL - 0.95, 0.04, width * 0.8), paint);
  roof.position.set(cx - length * 0.04 - 0.1, groundClear + bodyH + cabinH + 0.02, 0);
  g.add(roof);

  // wheels
  const wheelR = 0.32;
  const wheelW = 0.22;
  const wheelGeo = new THREE.CylinderGeometry(wheelR, wheelR, wheelW, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(wheelR * 0.6, wheelR * 0.6, wheelW + 0.02, 12);
  rimGeo.rotateX(Math.PI / 2);
  const wheels: THREE.Mesh[] = [];
  const frontWheels: THREE.Group[] = [];
  const t = spec.track / 2 + 0.02;
  const positions: [number, number, boolean][] = [
    [0, t, false],
    [0, -t, false],
    [spec.wheelbase, t, true],
    [spec.wheelbase, -t, true],
  ];
  for (const [wx, wz, front] of positions) {
    const w = new THREE.Mesh(wheelGeo, tyre);
    w.castShadow = true;
    const r = new THREE.Mesh(rimGeo, rim);
    const wg = new THREE.Group();
    wg.add(w, r);
    wheels.push(w);
    const pivot = new THREE.Group();
    pivot.position.set(wx, wheelR, -wz);
    pivot.add(wg);
    g.add(pivot);
    if (front) frontWheels.push(pivot);
  }

  // mirrors
  for (const side of [1, -1]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.18), paint);
    m.position.set(cx + cabinL / 2 - 0.5, groundClear + bodyH + 0.18, -side * (width / 2 + 0.09));
    g.add(m);
  }

  // lights
  const brakeLights = new THREE.MeshStandardMaterial({ color: 0x8b1111, emissive: 0x000000, roughness: 0.4 });
  const reverseLights = new THREE.MeshStandardMaterial({ color: 0xcccccc, emissive: 0x000000, roughness: 0.4 });
  const rearX = cx - length / 2 + 0.01;
  for (const side of [1, -1]) {
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.34), brakeLights);
    bl.position.set(rearX, groundClear + bodyH * 0.65, side * (width / 2 - 0.3));
    g.add(bl);
    const rl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.14), reverseLights);
    rl.position.set(rearX, groundClear + bodyH * 0.35, side * (width / 2 - 0.3));
    g.add(rl);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.4), new THREE.MeshStandardMaterial({ color: 0xf4f6f8, emissive: 0x6c7a89, emissiveIntensity: 0.35 }));
    hl.position.set(cx + length / 2 - 0.01, groundClear + bodyH * 0.6, side * (width / 2 - 0.32));
    g.add(hl);
  }
  // number plates
  for (const x of [rearX - 0.01, cx + length / 2 + 0.01]) {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.48), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    plate.position.set(x, groundClear + 0.2, 0);
    g.add(plate);
  }
  // bumpers
  for (const x of [rearX - 0.03, cx + length / 2 + 0.03]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, width), dark);
    b.position.set(x, groundClear + 0.12, 0);
    g.add(b);
  }

  let steeringWheel: THREE.Group | undefined;
  if (withInterior) {
    // simple dashboard + steering wheel visible from the driver camera
    const dash = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, width * 0.8), dark);
    dash.position.set(cx + cabinL / 2 - 0.75, groundClear + bodyH + 0.12, 0);
    g.add(dash);
    steeringWheel = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.022, 10, 40), dark);
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, 0.03), dark);
    steeringWheel.add(ring, spoke);
    steeringWheel.rotation.y = Math.PI / 2;
    steeringWheel.rotation.x = -0.35;
    steeringWheel.position.set(cx + cabinL / 2 - 1.05, groundClear + bodyH + 0.42, 0.37);
    g.add(steeringWheel);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x3a3f45 }));
    seat.position.set(cx - 0.1, groundClear + bodyH + 0.25, 0.37);
    g.add(seat);
  }

  return { group: g, frontWheels, wheels, brakeLights, reverseLights, steeringWheel };
}
