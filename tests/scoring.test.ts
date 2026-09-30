import { describe, expect, it } from 'vitest';
import { pointsFor, streakBonus, SIGN_DURATION_MS } from '@/engine/scoring';

describe('pointsFor', () => {
  it('gives 1200 at full time and 0 at zero', () => {
    expect(pointsFor(9000, 9000)).toBe(1200);
    expect(pointsFor(0, 9000)).toBe(0);
  });
  it('is linear and monotonic', () => {
    expect(pointsFor(4500, 9000)).toBe(600);
    expect(pointsFor(10000, 20000)).toBe(600);
    let last = Infinity;
    for (let t = 9000; t >= 0; t -= 500) {
      const p = pointsFor(t, 9000);
      expect(p).toBeLessThanOrEqual(last);
      last = p;
    }
  });
  it('matches measured Trafiko points within tolerance', () => {
    const measured: [number, number][] = [
      [0.966, 1154],
      [0.888, 1061],
      [0.777, 927],
      [0.666, 794],
      [0.555, 661],
      [0.3326, 394],
      [0.166, 194],
    ];
    for (const [frac, pts] of measured) {
      expect(Math.abs(pointsFor(frac * SIGN_DURATION_MS, SIGN_DURATION_MS) - pts)).toBeLessThanOrEqual(8);
    }
  });
  it('clamps out-of-range input', () => {
    expect(pointsFor(20000, 9000)).toBe(1200);
    expect(pointsFor(-5, 9000)).toBe(0);
  });
});

describe('streakBonus', () => {
  it('follows the milestone table', () => {
    expect(streakBonus(1)).toBe(0);
    expect(streakBonus(4)).toBe(0);
    expect(streakBonus(5)).toBe(500);
    expect(streakBonus(6)).toBe(0);
    expect(streakBonus(10)).toBe(1000);
    expect(streakBonus(15)).toBe(0);
    expect(streakBonus(20)).toBe(2000);
    expect(streakBonus(25)).toBe(0);
    expect(streakBonus(30)).toBe(2000);
    expect(streakBonus(100)).toBe(2000);
  });
});
