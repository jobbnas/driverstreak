import type { Question, QuestionStat } from '@/types';
import { pickNext } from './selector';
import type { Rng } from './rng';

const BOX_WEIGHT = [8, 4, 2, 1, 0.5] as const;
const DAY = 86400000;

/** Leitner-light weight: unseen and low-box questions come first, older ones get a boost. */
export function practiceWeight(stat: QuestionStat | undefined, now = Date.now()): number {
  if (!stat) return 6;
  const base = BOX_WEIGHT[stat.box] ?? 1;
  const ageDays = Math.max(0, (now - stat.lastSeen) / DAY);
  return base * (1 + Math.min(3, ageDays / 7));
}

export function pickPractice(
  pool: readonly Question[],
  asked: ReadonlySet<string> | readonly string[],
  stats: Record<string, QuestionStat>,
  rng: Rng,
  now = Date.now(),
): Question | undefined {
  return pickNext({ pool, asked, rng, position: 100, weightOf: (q) => practiceWeight(stats[q.id], now) });
}

export function nextBox(prev: QuestionStat['box'] | undefined, correct: boolean): QuestionStat['box'] {
  if (!correct) return 0;
  return Math.min(4, (prev ?? 0) + 1) as QuestionStat['box'];
}
