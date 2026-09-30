import type { Category, Difficulty, Question } from '@/types';
import { CATEGORIES } from '@/types';
import { weightedPick, type Rng } from './rng';

export interface PickInput<T extends { id: string; difficulty?: Difficulty }> {
  pool: readonly T[];
  asked: ReadonlySet<string> | readonly string[];
  recent?: ReadonlySet<string> | readonly string[];
  rng: Rng;
  /** Number of questions already answered in this run (drives the difficulty ramp). */
  position?: number;
  /** Optional per-item extra weight (e.g. Leitner). */
  weightOf?: (item: T) => number;
}

const RECENT_WEIGHT = 0.25;

function toSet(x: ReadonlySet<string> | readonly string[] | undefined): ReadonlySet<string> {
  if (!x) return new Set();
  return x instanceof Set ? x : new Set(x as readonly string[]);
}

export function difficultyWeight(d: Difficulty | undefined, position: number): number {
  if (!d) return 1;
  if (position < 5) return d === 1 ? 1 : d === 2 ? 0.25 : 0.05;
  if (position < 15) return d === 3 ? 0.4 : 1;
  return 1;
}

/**
 * Picks the next item: never repeats within the run, de-weights recently shown
 * items, and ramps difficulty. Returns undefined when the pool is exhausted.
 */
export function pickNext<T extends { id: string; difficulty?: Difficulty }>(input: PickInput<T>): T | undefined {
  const asked = toSet(input.asked);
  const recent = toSet(input.recent);
  const position = input.position ?? asked.size;
  const candidates = input.pool.filter((q) => !asked.has(q.id));
  if (candidates.length === 0) return undefined;
  const weights = candidates.map((q) => {
    let w = difficultyWeight(q.difficulty, position);
    if (recent.has(q.id)) w *= RECENT_WEIGHT;
    if (input.weightOf) w *= input.weightOf(q);
    return w;
  });
  return weightedPick(candidates, weights, input.rng);
}

/** Round-robin with jitter across categories for "Blandat" runs. */
export function nextMixedCategory(history: readonly Category[], rng: Rng, available: readonly Category[] = CATEGORIES): Category {
  const counts = new Map<Category, number>();
  for (const c of available) counts.set(c, 0);
  for (const c of history) counts.set(c, (counts.get(c) ?? 0) + 1);
  const min = Math.min(...available.map((c) => counts.get(c) ?? 0));
  const least = available.filter((c) => (counts.get(c) ?? 0) === min);
  const last = history[history.length - 1];
  const notLast = least.filter((c) => c !== last);
  const pool = notLast.length > 0 ? notLast : least;
  return pool[Math.floor(rng() * pool.length)] as Category;
}

export function questionsFor(all: readonly Question[], category: Category | 'blandat'): Question[] {
  return category === 'blandat' ? all.slice() : all.filter((q) => q.category === category);
}
