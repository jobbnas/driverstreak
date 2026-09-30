import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import { EXAM_BLUEPRINT, EXAM_TOTAL, buildExam, correctPosition, isCorrect, remainingMs, scoreExam, unansweredCount } from '@/engine/exam';
import type { Category, Question } from '@/types';

function makePool(perCat: number): Question[] {
  const out: Question[] = [];
  for (const cat of Object.keys(EXAM_BLUEPRINT) as Category[]) {
    for (let i = 0; i < perCat; i++) {
      out.push({
        id: `${cat}-s${i % 5}-${String(i).padStart(3, "0")}`,
        category: cat,
        subtopic: `s${i % 5}`,
        difficulty: ((i % 3) + 1) as 1 | 2 | 3,
        question: `Q ${cat} ${i}`,
        options: ['a', 'b', 'c', 'd'],
        correct: (i % 4) as 0 | 1 | 2 | 3,
        explanation: 'explanation long enough here',
      });
    }
  }
  return out;
}

describe('buildExam', () => {
  it('follows the blueprint and sums to 65', () => {
    const s = buildExam(makePool(40), mulberry32(1), 1000);
    expect(s.questions).toHaveLength(EXAM_TOTAL);
    expect(Object.values(EXAM_BLUEPRINT).reduce((a, b) => a + b, 0)).toBe(EXAM_TOTAL);
    const counts: Record<string, number> = {};
    for (const eq of s.questions) counts[eq.q.category] = (counts[eq.q.category] ?? 0) + 1;
    expect(counts).toEqual(EXAM_BLUEPRINT);
    expect(new Set(s.questions.map((e) => e.q.id)).size).toBe(EXAM_TOTAL);
    // subtopic spread: 22 trafikregler over 5 subtopics => each 4 or 5
    const tr = s.questions.filter((e) => e.q.category === 'trafikregler');
    const subCounts = new Map<string, number>();
    for (const e of tr) subCounts.set(e.q.subtopic, (subCounts.get(e.q.subtopic) ?? 0) + 1);
    for (const n of subCounts.values()) expect(n).toBeGreaterThanOrEqual(4);
  });
  it('fills from other categories when one lacks content', () => {
    const pool = makePool(40).filter((q) => q.category !== 'miljo');
    const s = buildExam(pool, mulberry32(2), 1000);
    expect(s.questions).toHaveLength(EXAM_TOTAL);
  });
  it('scores with shuffled option order and pass mark 52', () => {
    const s = buildExam(makePool(40), mulberry32(3), 1000);
    // answer first 52 correctly, rest wrong/unanswered
    s.questions.forEach((eq, i) => {
      if (i < 52) s.answers[i] = correctPosition(eq);
      else if (i < 60) s.answers[i] = (correctPosition(eq) + 1) % 4;
    });
    expect(unansweredCount(s)).toBe(5);
    const r = scoreExam(s, 2000);
    expect(r.correct).toBe(52);
    expect(r.passed).toBe(true);
    expect(r.total).toBe(65);
    const sum = Object.values(r.perArea).reduce((a, b) => a + b.total, 0);
    expect(sum).toBe(65);
    s.answers[0] = (correctPosition(s.questions[0]!) + 2) % 4;
    expect(scoreExam(s, 2000).passed).toBe(false);
    expect(isCorrect(s.questions[1]!, null)).toBe(false);
  });
  it('computes remaining time', () => {
    const s = buildExam(makePool(20), mulberry32(4), 1000);
    expect(remainingMs(s, 1000)).toBe(50 * 60 * 1000);
    expect(remainingMs(s, 1000 + 60 * 60 * 1000)).toBe(0);
  });
});
