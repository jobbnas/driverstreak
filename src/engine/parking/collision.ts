import type { CarSpec, Hit, Obstacle, Pose, Vec } from './types';
import { carObb } from './car';
import { obbOverlap, segHitsObb, type Obb, obbCorners, closestPointOnSeg } from './geometry';
import { dist } from './vec';

export const CONE_HALF = 0.18;
export const CART = { length: 1.0, width: 0.6 };

export function obstacleObb(o: Obstacle): Obb | undefined {
  switch (o.kind) {
    case 'car':
      return { c: { x: o.pose.x, y: o.pose.y }, hx: o.length / 2, hy: o.width / 2, ang: o.pose.heading };
    case 'cone':
      return { c: o.at, hx: CONE_HALF, hy: CONE_HALF, ang: 0 };
    case 'cart':
      return { c: { x: o.pose.x, y: o.pose.y }, hx: CART.length / 2, hy: CART.width / 2, ang: o.pose.heading };
    default:
      return undefined;
  }
}

/** Edges of an obstacle as segments (for sensors and segment tests). */
export function obstacleSegments(o: Obstacle): [Vec, Vec][] {
  if (o.kind === 'curb') {
    const out: [Vec, Vec][] = [];
    for (let i = 0; i < o.points.length - 1; i++) out.push([o.points[i] as Vec, o.points[i + 1] as Vec]);
    return out;
  }
  if (o.kind === 'wall') return [[o.a, o.b]];
  const obb = obstacleObb(o);
  if (!obb) return [];
  const c = obbCorners(obb);
  return [
    [c[0], c[1]],
    [c[1], c[2]],
    [c[2], c[3]],
    [c[3], c[0]],
  ];
}

export function collide(pose: Pose, spec: CarSpec, obstacles: readonly Obstacle[], speed: number): Hit[] {
  const car = carObb(pose, spec);
  const hits: Hit[] = [];
  const severity = Math.abs(speed) < 1.0 ? 'scratch' : 'bumper';
  for (const o of obstacles) {
    const obb = obstacleObb(o);
    if (obb) {
      if (obbOverlap(car, obb)) {
        hits.push({ obstacleId: o.id, kind: o.kind, point: nearestPoint(car, obb.c), speed, severity });
      }
      continue;
    }
    for (const [a, b] of obstacleSegments(o)) {
      if (segHitsObb(a, b, car)) {
        hits.push({ obstacleId: o.id, kind: o.kind, point: closestPointOnSeg(car.c, a, b), speed, severity });
        break;
      }
    }
  }
  return hits;
}

function nearestPoint(car: Obb, p: Vec): Vec {
  let best = car.c;
  let bd = Infinity;
  for (const c of obbCorners(car)) {
    const d = dist(c, p);
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
