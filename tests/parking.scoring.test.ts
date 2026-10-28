import { describe, expect, it } from 'vitest';
import { poseError, stars, collisionTier, movesTier, type Outcome } from '@/engine/parking/scoring';
import { DEFAULT_CAR } from '@/engine/parking/car';
import { SCENARIOS, scenarioById } from '@/engine/parking/scenarios';

describe('scoring', () => {
  const ficka = scenarioById('ficka-stor')!;
  const ruta = scenarioById('back-ruta')!;
  it('grades the ideal pose 3 and a far-from-curb pose lower', () => {
    const t = ficka.target!;
    const e = poseError({ ...t.pose }, t, DEFAULT_CAR, ficka);
    expect(e.grade).toBe(3);
    expect(e.curbDist).toBeCloseTo(0.25, 2);
    const far = poseError({ ...t.pose, y: t.pose.y + 0.3 }, t, DEFAULT_CAR, ficka);
    expect(far.grade).toBe(2);
    const farther = poseError({ ...t.pose, y: t.pose.y + 0.6 }, t, DEFAULT_CAR, ficka);
    expect(farther.grade).toBe(1);
    const off = poseError({ ...t.pose, y: t.pose.y + 1.2 }, t, DEFAULT_CAR, ficka);
    expect(off.grade).toBe(0);
    const crooked = poseError({ ...t.pose, heading: (8 * Math.PI) / 180 }, t, DEFAULT_CAR, ficka);
    expect(crooked.grade).toBeLessThanOrEqual(1);
  });
  it('bay must contain all corners', () => {
    const t = ruta.target!;
    expect(poseError(t.pose, t, DEFAULT_CAR, ruta).grade).toBe(3);
    const out = poseError({ ...t.pose, x: t.pose.x + 0.45 }, t, DEFAULT_CAR, ruta);
    expect(out.insideBay).toBe(false);
    expect(out.grade).toBe(0);
    const slight = poseError({ ...t.pose, x: t.pose.x + 0.2 }, t, DEFAULT_CAR, ruta);
    expect(slight.grade).toBe(2);
  });
  it('combines tiers', () => {
    expect(collisionTier(0)).toBe(3);
    expect(collisionTier(2)).toBe(1);
    expect(movesTier(3, 3)).toBe(3);
    expect(movesTier(5, 3)).toBe(2);
    expect(movesTier(6, 3)).toBe(1);
    const base: Outcome = { finished: true, failed: false, pose: { lon: 0, lat: 0, headingDeg: 0, insideBay: true, bayOverrun: 0, grade: 3 }, collisions: 0, moves: 3, conesHit: 0, timeMs: 1000 };
    expect(stars(base, ficka)).toBe(3);
    expect(stars({ ...base, collisions: 1 }, ficka)).toBe(2);
    expect(stars({ ...base, moves: 6 }, ficka)).toBe(1);
    expect(stars({ ...base, failed: true }, ficka)).toBe(0);
    expect(stars({ ...base, finished: false }, ficka)).toBe(0);
    const tre = scenarioById('trepunkt')!;
    expect(stars({ ...base, moves: 3 }, tre)).toBe(3);
    expect(stars({ ...base, moves: 5 }, tre)).toBe(2);
    const sand = SCENARIOS[0]!;
    expect(stars({ ...base, pose: undefined, conesHit: 0 }, sand)).toBe(3);
    expect(stars({ ...base, pose: undefined, conesHit: 2 }, sand)).toBe(2);
    expect(stars({ ...base, pose: undefined, conesHit: 3 }, sand)).toBe(1);
  });
});
