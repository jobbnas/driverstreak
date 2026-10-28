import * as THREE from 'three';
import type { Scenario, Vec } from '@/engine/parking/types';
import { CART, CONE_HALF } from '@/engine/parking/collision';
import { DEFAULT_CAR } from '@/engine/parking/car';
import { buildCar } from './carMesh';

const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x3b3d40, roughness: 0.95 });
const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x9a9690, roughness: 0.9 });
const curbMat = new THREE.MeshStandardMaterial({ color: 0xb9b5ae, roughness: 0.85 });
const lineMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.7 });
const chalkMat = new THREE.MeshStandardMaterial({ color: 0xffe58a, roughness: 0.7 });
const targetMat = new THREE.MeshBasicMaterial({ color: 0x5dc98f, transparent: true, opacity: 0.22, depthWrite: false });
const ghostMat = new THREE.MeshBasicMaterial({ color: 0x5dc98f, transparent: true, opacity: 0.6, depthWrite: false });
const coneMat = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.6 });
const coneBand = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
const grassMat = new THREE.MeshStandardMaterial({ color: 0x6f9a4a, roughness: 1 });
const buildingMats = [0xc9b79c, 0xb8c4cc, 0xd9c7b2, 0xa8b0a0].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 }));

function polyMesh(points: Vec[], y: number, mat: THREE.Material): THREE.Mesh {
  const shape = new THREE.Shape(points.map((p) => new THREE.Vector2(p.x, -p.y)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2); // shape (x, y') -> (x, 0, -y')... ShapeGeometry lies in XY; rotate so Y -> -Z
  const m = new THREE.Mesh(geo, mat);
  m.position.y = y;
  m.receiveShadow = true;
  return m;
}

/** Thin strip along a polyline, width w, at height y. */
function stripMesh(points: Vec[], w: number, y: number, mat: THREE.Material, dashed = false): THREE.Group {
  const g = new THREE.Group();
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i] as Vec;
    const b = points[i + 1] as Vec;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    const ang = Math.atan2(dy, dx);
    if (!dashed) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(len + w, 0.01, w), mat);
      m.position.set((a.x + b.x) / 2, y, -(a.y + b.y) / 2);
      m.rotation.y = ang;
      g.add(m);
    } else {
      const dash = 1.0;
      const gap = 1.0;
      for (let s = 0; s < len; s += dash + gap) {
        const l = Math.min(dash, len - s);
        const cx = a.x + (dx / len) * (s + l / 2);
        const cy = a.y + (dy / len) * (s + l / 2);
        const m = new THREE.Mesh(new THREE.BoxGeometry(l, 0.01, w), mat);
        m.position.set(cx, y, -cy);
        m.rotation.y = ang;
        g.add(m);
      }
    }
  }
  return g;
}

export interface WorldParts {
  group: THREE.Group;
  ghost: THREE.Group;
  parkedCars: THREE.Group[];
}

export function buildWorld(sc: Scenario): WorldParts {
  const g = new THREE.Group();
  const pad = 40;
  // grass far away, asphalt for the world rect
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(sc.world.w + pad * 2, sc.world.h + pad * 2), grassMat);
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(sc.world.w / 2, -0.02, -sc.world.h / 2 + 4);
  grass.receiveShadow = true;
  g.add(grass);
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(sc.world.w + 8, sc.world.h + 8), asphaltMat);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.set(sc.world.w / 2, 0, -sc.world.h / 2 + 4);
  asphalt.receiveShadow = true;
  g.add(asphalt);

  for (const sw of sc.world.sidewalks ?? []) {
    const m = polyMesh(sw, 0.13, sidewalkMat);
    g.add(m);
    // slab side faces: approximate with a thin extruded box per edge
    for (let i = 0; i < sw.length; i++) {
      const a = sw[i] as Vec;
      const b = sw[(i + 1) % sw.length] as Vec;
      const len = Math.hypot(b.x - a.x, b.y - a.y);
      const side = new THREE.Mesh(new THREE.BoxGeometry(len, 0.13, 0.04), sidewalkMat);
      side.position.set((a.x + b.x) / 2, 0.065, -(a.y + b.y) / 2);
      side.rotation.y = Math.atan2(b.y - a.y, b.x - a.x);
      g.add(side);
    }
  }
  for (const b of sc.world.buildings ?? []) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b.w, b.h, b.d), buildingMats[(b.w * 7 + b.d) % buildingMats.length] as THREE.Material);
    m.position.set(b.at.x + b.w / 2, b.h / 2, -(b.at.y + b.d / 2));
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, 0.3, b.d + 0.4), new THREE.MeshStandardMaterial({ color: 0x5a3f36, roughness: 0.9 }));
    roof.position.set(b.at.x + b.w / 2, b.h + 0.15, -(b.at.y + b.d / 2));
    g.add(roof);
  }

  const parkedCars: THREE.Group[] = [];
  for (const o of sc.obstacles) {
    switch (o.kind) {
      case 'curb': {
        g.add(stripMesh(o.points, 0.16, 0.07, curbMat));
        const top = stripMesh(o.points, 0.16, 0.14, curbMat);
        g.add(top);
        break;
      }
      case 'wall': {
        const len = Math.hypot(o.b.x - o.a.x, o.b.y - o.a.y);
        const m = new THREE.Mesh(new THREE.BoxGeometry(len, o.height ?? 1.2, 0.2), sidewalkMat);
        m.position.set((o.a.x + o.b.x) / 2, (o.height ?? 1.2) / 2, -(o.a.y + o.b.y) / 2);
        m.rotation.y = Math.atan2(o.b.y - o.a.y, o.b.x - o.a.x);
        m.castShadow = true;
        g.add(m);
        break;
      }
      case 'car': {
        const car = buildCar(DEFAULT_CAR, o.color, false, o.length, o.width);
        // obstacle pose is the body centre; our car group origin is the rear axle -> shift back
        const centreOffset = DEFAULT_CAR.wheelbase / 2 + (DEFAULT_CAR.frontOverhang - (o.length - DEFAULT_CAR.wheelbase - DEFAULT_CAR.frontOverhang)) / 2;
        car.group.position.set(o.pose.x - Math.cos(o.pose.heading) * centreOffset, 0, -(o.pose.y - Math.sin(o.pose.heading) * centreOffset));
        car.group.rotation.y = o.pose.heading;
        g.add(car.group);
        parkedCars.push(car.group);
        break;
      }
      case 'cone': {
        const c = new THREE.Mesh(new THREE.ConeGeometry(CONE_HALF, 0.55, 14), coneMat);
        c.position.set(o.at.x, 0.275, -o.at.y);
        c.castShadow = true;
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.08, 14), coneBand);
        band.position.set(o.at.x, 0.3, -o.at.y);
        const base = new THREE.Mesh(new THREE.BoxGeometry(CONE_HALF * 2, 0.03, CONE_HALF * 2), coneMat);
        base.position.set(o.at.x, 0.015, -o.at.y);
        g.add(c, band, base);
        break;
      }
      case 'cart': {
        const cart = new THREE.Group();
        const basket = new THREE.Mesh(new THREE.BoxGeometry(CART.length, 0.45, CART.width), new THREE.MeshStandardMaterial({ color: 0xcfd6dc, roughness: 0.5, metalness: 0.6, wireframe: true }));
        basket.position.y = 0.6;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(CART.length, 0.05, CART.width), new THREE.MeshStandardMaterial({ color: 0x9aa3aa, metalness: 0.7, roughness: 0.4 }));
        frame.position.y = 0.37;
        const handle = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, CART.width), new THREE.MeshStandardMaterial({ color: 0xd04040 }));
        handle.position.set(-CART.length / 2, 0.95, 0);
        cart.add(basket, frame, handle);
        cart.position.set(o.pose.x, 0, -o.pose.y);
        cart.rotation.y = o.pose.heading;
        g.add(cart);
        break;
      }
    }
  }

  for (const m of sc.markings) {
    if (m.kind === 'bay') {
      const pts = [...m.points, m.points[0] as Vec];
      g.add(stripMesh(pts, 0.1, 0.012, lineMat));
    } else if (m.kind === 'line') {
      g.add(stripMesh(m.points, 0.1, 0.012, lineMat, m.dashed));
    } else if (m.kind === 'chalk') {
      const pts = [...m.points, m.points[0] as Vec];
      g.add(stripMesh(pts, 0.12, 0.012, chalkMat));
    }
  }

  if (sc.target) {
    const t = sc.target;
    if (t.bay) {
      g.add(polyMesh(t.bay, 0.02, targetMat));
    } else {
      // show the ideal footprint as a translucent rectangle
      const cx = t.pose.x + Math.cos(t.pose.heading) * 1.23;
      const cy = t.pose.y + Math.sin(t.pose.heading) * 1.23;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(t.tolerance.lonFree ? 4.7 : 4.7 + t.tolerance.lon * 2, 1.83 + 0.4), targetMat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = 0;
      m.position.set(cx, 0.02, -cy);
      m.rotateOnWorldAxis(new THREE.Vector3(0, 1, 0), t.pose.heading);
      g.add(m);
    }
  }

  const ghost = new THREE.Group();
  g.add(ghost);
  return { group: g, ghost, parkedCars };
}

/** Ghost path: dashed ribbon on the ground from a polyline of rear-axle positions. */
export function buildGhost(path: Vec[]): THREE.Group {
  const g = new THREE.Group();
  const step = 2;
  for (let i = 0; i + 1 < path.length; i += step) {
    const a = path[i] as Vec;
    const b = path[Math.min(i + 1, path.length - 1)] as Vec;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len < 1e-4) continue;
    const m = new THREE.Mesh(new THREE.BoxGeometry(len, 0.01, 0.1), ghostMat);
    m.position.set((a.x + b.x) / 2, 0.025, -(a.y + b.y) / 2);
    m.rotation.y = Math.atan2(b.y - a.y, b.x - a.x);
    g.add(m);
  }
  return g;
}
