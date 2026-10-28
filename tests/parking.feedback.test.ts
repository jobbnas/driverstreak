import { describe, expect, it } from 'vitest';
import { badgesEarned, damageOf, remark, hitCost } from '@/engine/parking/feedback';
import { scenarioById, SCENARIOS } from '@/engine/parking/scenarios';
import type { Outcome } from '@/engine/parking/scoring';

describe('feedback', () => {
  const ficka = scenarioById('ficka-stor')!;
  const base: Outcome = { finished: true, failed: false, pose: { lon: 0, lat: 0, headingDeg: 0, curbDist: 0.2, insideBay: true, bayOverrun: 0, grade: 3 }, collisions: 0, moves: 2, conesHit: 0, timeMs: 1000 };
  it('costs', () => {
    const hit = { obstacleId: 'F', kind: 'car' as const, point: { x: 0, y: 0 }, speed: 0.5, severity: 'scratch' as const };
    expect(hitCost(hit, ficka)).toBe(3500);
    expect(hitCost({ ...hit, severity: 'bumper' }, ficka)).toBe(9000);
    expect(hitCost({ ...hit, kind: 'cone' }, SCENARIOS[0]!)).toBe(0);
    expect(damageOf([hit, { ...hit, severity: 'bumper' }], ficka)).toBe(12500);
  });
  it('remarks are deterministic and context aware', () => {
    expect(remark(base, 3, ficka, 7)).toBe(remark(base, 3, ficka, 7));
    expect(remark({ ...base, failed: true }, 0, ficka, 1)).toMatch(/avbryter|smällar/);
    expect(remark({ ...base, pose: { ...base.pose!, curbDist: 0.8 } }, 1, ficka, 1)).toMatch(/cykel|långt ut/);
  });
  it('badges', () => {
    const ctx = { scenarioId: 'hornet' as const, stars: 3 as const, outcome: base, coaching: true, curbStreak: 0, damageTotal: 0 };
    expect(badgesEarned(ctx, [])).toEqual(['runt-hornet']);
    expect(badgesEarned(ctx, ['runt-hornet'])).toEqual([]);
    expect(badgesEarned({ ...ctx, scenarioId: 'ficka-stor', coaching: false, curbStreak: 3, damageTotal: 60000 }, [])).toEqual(['kantstensmastare', 'utan-hjalp', 'platslagarens-favorit']);
  });
});
