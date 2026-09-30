import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import { nextBox, pickPractice, practiceWeight } from '@/engine/practice';
import type { Question, QuestionStat } from '@/types';

const q = (id: string): Question => ({ id, category: 'miljo', subtopic: 'eco', difficulty: 1, question: 'x?', options: ['a', 'b', 'c', 'd'], correct: 0, explanation: 'long enough explanation' });

describe('practice', () => {
  it('weights unseen and low boxes higher, and boosts old items', () => {
    const now = 1_000_000_000_000;
    const fresh: QuestionStat = { seen: 1, correct: 1, wrong: 0, lastSeen: now, box: 4 };
    const weak: QuestionStat = { seen: 3, correct: 0, wrong: 3, lastSeen: now, box: 0 };
    const old: QuestionStat = { seen: 1, correct: 1, wrong: 0, lastSeen: now - 30 * 86400000, box: 4 };
    expect(practiceWeight(undefined, now)).toBeGreaterThan(practiceWeight(fresh, now));
    expect(practiceWeight(weak, now)).toBeGreaterThan(practiceWeight(undefined, now));
    expect(practiceWeight(old, now)).toBeGreaterThan(practiceWeight(fresh, now));
  });
  it('box transitions', () => {
    expect(nextBox(undefined, true)).toBe(1);
    expect(nextBox(3, true)).toBe(4);
    expect(nextBox(4, true)).toBe(4);
    expect(nextBox(4, false)).toBe(0);
  });
  it('picks weak questions more often', () => {
    const now = 1_000_000_000_000;
    const pool = [q('a'), q('b'), q('c'), q('d')];
    const stats: Record<string, QuestionStat> = {
      a: { seen: 5, correct: 5, wrong: 0, lastSeen: now, box: 4 },
      b: { seen: 5, correct: 5, wrong: 0, lastSeen: now, box: 4 },
      c: { seen: 5, correct: 5, wrong: 0, lastSeen: now, box: 4 },
      d: { seen: 5, correct: 0, wrong: 5, lastSeen: now, box: 0 },
    };
    const rng = mulberry32(8);
    let d = 0;
    for (let i = 0; i < 300; i++) if (pickPractice(pool, [], stats, rng, now)?.id === 'd') d++;
    expect(d).toBeGreaterThan(200);
  });
});
