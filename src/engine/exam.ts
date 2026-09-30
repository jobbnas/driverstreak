import type { Category, ExamAnswer, ExamResult, Question } from '@/types';
import { shuffle, type Rng } from './rng';

export const EXAM_TOTAL = 65;
export const EXAM_PASS = 52;
export const EXAM_DURATION_MS = 50 * 60 * 1000;

/** Approximate area weights; Trafikverket does not publish exact numbers. */
export const EXAM_BLUEPRINT: Record<Category, number> = {
  trafikregler: 22,
  trafiksakerhet: 14,
  fordon: 9,
  miljo: 6,
  personliga: 8,
  vagmarken: 6,
};

export interface ExamQuestion {
  q: Question;
  /** Shuffled option order: order[i] = original index shown at position i. */
  order: [number, number, number, number];
}

export interface ExamSession {
  id: string;
  startedAt: number;
  durationMs: number;
  questions: ExamQuestion[];
  /** chosen position index (0..3) or null. */
  answers: (number | null)[];
  flagged: boolean[];
  cursor: number;
}

/** Stratified sample: per category by blueprint, spreading over subtopics and mixing difficulty. */
export function buildExam(all: readonly Question[], rng: Rng, now = Date.now(), blueprint = EXAM_BLUEPRINT): ExamSession {
  const picked: Question[] = [];
  const leftovers: Question[] = [];
  for (const [cat, want] of Object.entries(blueprint) as [Category, number][]) {
    const pool = shuffle(all.filter((q) => q.category === cat), rng);
    const bySub = new Map<string, Question[]>();
    for (const q of pool) {
      const arr = bySub.get(q.subtopic) ?? [];
      arr.push(q);
      bySub.set(q.subtopic, arr);
    }
    const chosen: Question[] = [];
    // round-robin across subtopics so coverage is broad
    const subs = shuffle([...bySub.keys()], rng);
    let idx = 0;
    let guard = 0;
    while (chosen.length < want && guard < 10000) {
      guard++;
      const sub = subs[idx % Math.max(1, subs.length)];
      idx++;
      if (sub === undefined) break;
      const arr = bySub.get(sub);
      if (arr && arr.length) chosen.push(arr.shift() as Question);
      if ([...bySub.values()].every((a) => a.length === 0)) break;
    }
    picked.push(...chosen);
    leftovers.push(...[...bySub.values()].flat());
  }
  // fill if some category lacks content
  const fill = shuffle(leftovers, rng);
  while (picked.length < EXAM_TOTAL && fill.length) picked.push(fill.pop() as Question);
  const questions = shuffle(picked.slice(0, EXAM_TOTAL), rng).map((q) => ({
    q,
    order: shuffle([0, 1, 2, 3], rng) as [number, number, number, number],
  }));
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : String(now),
    startedAt: now,
    durationMs: EXAM_DURATION_MS,
    questions,
    answers: questions.map(() => null),
    flagged: questions.map(() => false),
    cursor: 0,
  };
}

export function remainingMs(session: ExamSession, now = Date.now()): number {
  return Math.max(0, session.startedAt + session.durationMs - now);
}

export function isCorrect(eq: ExamQuestion, chosenPos: number | null): boolean {
  if (chosenPos === null) return false;
  return eq.order[chosenPos] === eq.q.correct;
}

export function correctPosition(eq: ExamQuestion): number {
  return eq.order.indexOf(eq.q.correct);
}

export function scoreExam(session: ExamSession, endedAt = Date.now()): ExamResult {
  const perArea = {} as ExamResult['perArea'];
  const answers: ExamAnswer[] = session.questions.map((eq, i) => {
    const chosen = session.answers[i] ?? null;
    const ok = isCorrect(eq, chosen);
    const row = (perArea[eq.q.category] ??= { correct: 0, total: 0 });
    row.total++;
    if (ok) row.correct++;
    return { qid: eq.q.id, chosen, correct: ok, flagged: session.flagged[i] ?? false };
  });
  const correct = answers.filter((a) => a.correct).length;
  const total = session.questions.length;
  const pass = Math.round((EXAM_PASS / EXAM_TOTAL) * total);
  return {
    id: session.id,
    startedAt: session.startedAt,
    endedAt,
    passed: correct >= pass,
    correct,
    total,
    perArea,
    answers,
  };
}

export function unansweredCount(session: ExamSession): number {
  return session.answers.filter((a) => a === null).length;
}
