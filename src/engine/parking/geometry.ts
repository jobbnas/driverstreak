import type { Vec } from './types';
import { cross, dot, sub, rot, add, v } from './vec';

export interface Obb {
  c: Vec;
  hx: number;
  hy: number;
  ang: number;
}

/** Corners in order: front-right, front-left, rear-left, rear-right (relative to +x heading). */
export function obbCorners(o: Obb): [Vec, Vec, Vec, Vec] {
  const fr = add(o.c, rot(v(o.hx, -o.hy), o.ang));
  const fl = add(o.c, rot(v(o.hx, o.hy), o.ang));
  const rl = add(o.c, rot(v(-o.hx, o.hy), o.ang));
  const rr = add(o.c, rot(v(-o.hx, -o.hy), o.ang));
  return [fr, fl, rl, rr];
}

function project(points: readonly Vec[], axis: Vec): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const d = dot(p, axis);
    if (d < min) min = d;
    if (d > max) max = d;
  }
  return [min, max];
}

/** Separating axis theorem for two oriented boxes. */
export function obbOverlap(a: Obb, b: Obb): boolean {
  const ca = obbCorners(a);
  const cb = obbCorners(b);
  const axes = [
    v(Math.cos(a.ang), Math.sin(a.ang)),
    v(-Math.sin(a.ang), Math.cos(a.ang)),
    v(Math.cos(b.ang), Math.sin(b.ang)),
    v(-Math.sin(b.ang), Math.cos(b.ang)),
  ];
  for (const axis of axes) {
    const [minA, maxA] = project(ca, axis);
    const [minB, maxB] = project(cb, axis);
    if (maxA < minB || maxB < minA) return false;
  }
  return true;
}

export function pointInObb(p: Vec, o: Obb): boolean {
  const local = rot(sub(p, o.c), -o.ang);
  return Math.abs(local.x) <= o.hx && Math.abs(local.y) <= o.hy;
}

export function pointInPoly(p: Vec, poly: readonly Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i] as Vec;
    const b = poly[j] as Vec;
    const intersect = a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x;
    if (intersect) inside = !inside;
  }
  return inside;
}

function orient(a: Vec, b: Vec, c: Vec): number {
  return cross(sub(b, a), sub(c, a));
}

function onSegment(a: Vec, b: Vec, p: Vec): boolean {
  return (
    Math.min(a.x, b.x) - 1e-9 <= p.x && p.x <= Math.max(a.x, b.x) + 1e-9 && Math.min(a.y, b.y) - 1e-9 <= p.y && p.y <= Math.max(a.y, b.y) + 1e-9
  );
}

export function segIntersects(p: Vec, p2: Vec, q: Vec, q2: Vec): boolean {
  const d1 = orient(q, q2, p);
  const d2 = orient(q, q2, p2);
  const d3 = orient(p, p2, q);
  const d4 = orient(p, p2, q2);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (Math.abs(d1) < 1e-12 && onSegment(q, q2, p)) return true;
  if (Math.abs(d2) < 1e-12 && onSegment(q, q2, p2)) return true;
  if (Math.abs(d3) < 1e-12 && onSegment(p, p2, q)) return true;
  if (Math.abs(d4) < 1e-12 && onSegment(p, p2, q2)) return true;
  return false;
}

export function segHitsObb(a: Vec, b: Vec, o: Obb): boolean {
  const c = obbCorners(o);
  for (let i = 0; i < 4; i++) {
    if (segIntersects(a, b, c[i] as Vec, c[(i + 1) % 4] as Vec)) return true;
  }
  return pointInObb(a, o) || pointInObb(b, o);
}

export function closestPointOnSeg(p: Vec, a: Vec, b: Vec): Vec {
  const ab = sub(b, a);
  const l2 = dot(ab, ab);
  if (l2 < 1e-12) return a;
  const t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / l2));
  return add(a, { x: ab.x * t, y: ab.y * t });
}

export function pointSegDist(p: Vec, a: Vec, b: Vec): number {
  const q = closestPointOnSeg(p, a, b);
  return Math.hypot(p.x - q.x, p.y - q.y);
}

/** Distance between two segments and the closest point on the second one. */
export function segSegDist(a: Vec, b: Vec, c: Vec, d: Vec): { d: number; point: Vec } {
  if (segIntersects(a, b, c, d)) {
    return { d: 0, point: closestPointOnSeg(a, c, d) };
  }
  let best = { d: Infinity, point: c };
  const consider = (p: Vec, s1: Vec, s2: Vec, onSecond: boolean) => {
    const q = closestPointOnSeg(p, s1, s2);
    const dd = Math.hypot(p.x - q.x, p.y - q.y);
    if (dd < best.d) best = { d: dd, point: onSecond ? q : p };
  };
  consider(a, c, d, true);
  consider(b, c, d, true);
  consider(c, a, b, false);
  consider(d, a, b, false);
  return best;
}

export function obbEdges(o: Obb): [Vec, Vec][] {
  const c = obbCorners(o);
  return [
    [c[0], c[1]],
    [c[1], c[2]],
    [c[2], c[3]],
    [c[3], c[0]],
  ];
}

/** Sample a quarter arc as a polyline (for rounded curb corners). */
export function arcPoints(center: Vec, r: number, fromAng: number, toAng: number, segments = 8): Vec[] {
  const out: Vec[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = fromAng + ((toAng - fromAng) * i) / segments;
    out.push({ x: center.x + r * Math.cos(a), y: center.y + r * Math.sin(a) });
  }
  return out;
}
