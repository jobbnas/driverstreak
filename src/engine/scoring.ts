export const MAX_POINTS = 1200;
export const SIGN_DURATION_MS = 9000;
export const TEXT_DURATION_MS = 20000;
export const FEEDBACK_MS = 1200;

/** Trafiko formula: linear in remaining time, max 1200. */
export function pointsFor(timeLeftMs: number, durationMs: number): number {
  if (durationMs <= 0) return 0;
  const frac = timeLeftMs / durationMs;
  return Math.max(0, Math.min(MAX_POINTS, Math.round(MAX_POINTS * frac)));
}

/** Streak milestone bonus: +500 at 5, +1000 at 10, +2000 at 20 and every further 10. */
export function streakBonus(n: number): number {
  if (n === 5) return 500;
  if (n === 10) return 1000;
  if (n >= 20 && n % 10 === 0) return 2000;
  return 0;
}

export function bonusLabel(n: number): string {
  return `${n} i rad!`;
}
