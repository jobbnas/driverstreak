import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import { difficultyWeight, nextMixedCategory, pickNext } from '@/engine/selector';
import type { Category, Difficulty } from '@/types';

interface Item { id: string; difficulty: Difficulty }
const pool: Item[] = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, difficulty: ((i % 3) + 1) as Difficulty }));

describe('pickNext', () => {
  it('never repeats within a run and exhausts the pool', () => {
    const rng = mulberry32(42);
    const asked: string[] = [];
    for (let i = 0; i < 30; i++) {
      const q = pickNext({ pool, asked, rng, position: i });
      expect(q).toBeDefined();
      expect(asked).not.toContain(q!.id);
      asked.push(q!.id);
    }
    expect(pickNext({ pool, asked, rng })).toBeUndefined();
  });
  it('prefers easy questions early', () => {
    expect(difficultyWeight(1, 0)).toBeGreaterThan(difficultyWeight(3, 0));
    expect(difficultyWeight(3, 20)).toBe(1);
    const rng = mulberry32(7);
    let easy = 0;
    for (let i = 0; i < 200; i++) {
      const q = pickNext({ pool, asked: [], rng, position: 0 });
      if (q?.difficulty === 1) easy++;
    }
    expect(easy).toBeGreaterThan(140);
  });
  it('de-weights recent items', () => {
    const rng = mulberry32(3);
    const recent = pool.slice(0, 15).map((q) => q.id);
    let recentHits = 0;
    for (let i = 0; i < 400; i++) {
      const q = pickNext({ pool, asked: [], recent, rng, position: 20 });
      if (recent.includes(q!.id)) recentHits++;
    }
    expect(recentHits).toBeLessThan(140);
  });
});

describe('nextMixedCategory', () => {
  it('spreads categories evenly and avoids immediate repeats', () => {
    const rng = mulberry32(1);
    const history: Category[] = [];
    for (let i = 0; i < 60; i++) history.push(nextMixedCategory(history, rng));
    const counts = new Map<Category, number>();
    for (const c of history) counts.set(c, (counts.get(c) ?? 0) + 1);
    for (const n of counts.values()) expect(n).toBe(10);
    for (let i = 1; i < history.length; i++) expect(history[i]).not.toBe(history[i - 1]);
  });
});
