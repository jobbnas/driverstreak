import type { ExamSession } from '@/engine/exam';
import type { Question } from '@/types';

const KEY = 'ds:exam:inprogress';

interface Stored {
  id: string;
  startedAt: number;
  durationMs: number;
  qids: string[];
  orders: [number, number, number, number][];
  answers: (number | null)[];
  flagged: boolean[];
  cursor: number;
}

export function saveSession(s: ExamSession): void {
  const data: Stored = {
    id: s.id,
    startedAt: s.startedAt,
    durationMs: s.durationMs,
    qids: s.questions.map((q) => q.q.id),
    orders: s.questions.map((q) => q.order),
    answers: s.answers,
    flagged: s.flagged,
    cursor: s.cursor,
  };
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export function hasStoredSession(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export function loadSession(all: readonly Question[]): ExamSession | undefined {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return undefined;
    const d = JSON.parse(raw) as Stored;
    const byId = new Map(all.map((q) => [q.id, q]));
    const questions = d.qids.map((id, i) => ({ q: byId.get(id) as Question, order: d.orders[i] as [number, number, number, number] }));
    if (questions.some((x) => !x.q)) return undefined;
    return { id: d.id, startedAt: d.startedAt, durationMs: d.durationMs, questions, answers: d.answers, flagged: d.flagged, cursor: d.cursor };
  } catch {
    return undefined;
  }
}
