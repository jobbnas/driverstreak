import { describe, expect, it } from 'vitest';
import { obbOverlap, segHitsObb, segSegDist, pointInPoly, arcPoints, segIntersects } from '@/engine/parking/geometry';

describe('OBB', () => {
  const a = { c: { x: 0, y: 0 }, hx: 2, hy: 1, ang: 0 };
  it('overlaps when coincident and not when separated by a gap', () => {
    expect(obbOverlap(a, { ...a })).toBe(true);
    expect(obbOverlap(a, { c: { x: 4.01, y: 0 }, hx: 2, hy: 1, ang: 0 })).toBe(false);
    expect(obbOverlap(a, { c: { x: 3.99, y: 0 }, hx: 2, hy: 1, ang: 0 })).toBe(true);
  });
  it('rejects a rotated box that AABB would flag', () => {
    // box rotated 45deg near the corner of a: its AABB overlaps, the OBB does not
    const b = { c: { x: 3.2, y: 2.2 }, hx: 1.2, hy: 0.2, ang: Math.PI / 4 };
    expect(obbOverlap(a, b)).toBe(false);
    const c = { c: { x: 2.4, y: 1.3 }, hx: 1.2, hy: 0.4, ang: Math.PI / 4 };
    expect(obbOverlap(a, c)).toBe(true);
  });
});

describe('segments', () => {
  const box = { c: { x: 0, y: 0 }, hx: 1, hy: 1, ang: 0 };
  it('crossing, inside and outside', () => {
    expect(segHitsObb({ x: -3, y: 0 }, { x: 3, y: 0 }, box)).toBe(true);
    expect(segHitsObb({ x: -0.5, y: -0.5 }, { x: 0.5, y: 0.5 }, box)).toBe(true);
    expect(segHitsObb({ x: -3, y: 1.01 }, { x: 3, y: 1.01 }, box)).toBe(false);
    expect(segIntersects({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 })).toBe(true);
    expect(segIntersects({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });
  it('distances', () => {
    expect(segSegDist({ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }, { x: 1, y: 0 }).d).toBe(0);
    const r = segSegDist({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 0.5 }, { x: 2, y: 0.5 });
    expect(r.d).toBeCloseTo(0.5, 9);
    expect(r.point.y).toBeCloseTo(0.5, 9);
  });
  it('point in polygon and arcs', () => {
    const sq = [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }];
    expect(pointInPoly({ x: 1, y: 1 }, sq)).toBe(true);
    expect(pointInPoly({ x: 3, y: 1 }, sq)).toBe(false);
    const arc = arcPoints({ x: 0, y: 0 }, 2, 0, Math.PI / 2, 4);
    expect(arc).toHaveLength(5);
    expect(arc[4]!.x).toBeCloseTo(0, 9);
    expect(arc[4]!.y).toBeCloseTo(2, 9);
  });
});
