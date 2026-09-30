import type { Category, ExamResult, GameRun, QuestionStat, Stats, StreakCategory } from '@/types';

export const STORAGE_KEY = 'ds:v1';
const MAX_RUNS = 300;
const MAX_EXAMS = 50;
const RECENT_PER_CATEGORY = 60;

export function defaultStats(): Stats {
  return {
    version: 1,
    runs: [],
    exams: [],
    questions: {},
    daily: { current: 0, longest: 0, lastDay: '', days: [] },
    recent: {},
    settings: { haptics: true, reducedMotion: 'auto', textTimerSec: 20 },
  };
}

/** Local calendar day key YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function previousDayKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d, 12); // noon avoids DST edge cases
  date.setDate(date.getDate() - 1);
  return dayKey(date);
}

/** Registers activity today and updates the daily streak. Returns the new stats object. */
export function touchDaily(stats: Stats, today: string = dayKey()): Stats {
  const { daily } = stats;
  if (daily.lastDay === today) return stats;
  const continues = daily.lastDay === previousDayKey(today);
  const current = continues ? daily.current + 1 : 1;
  const days = [...daily.days, today].slice(-120);
  return {
    ...stats,
    daily: { current, longest: Math.max(daily.longest, current), lastDay: today, days },
  };
}

/** Current streak as of `today` (0 if the last activity was before yesterday). */
export function currentDailyStreak(stats: Stats, today: string = dayKey()): number {
  const { daily } = stats;
  if (daily.lastDay === today || daily.lastDay === previousDayKey(today)) return daily.current;
  return 0;
}

export function recordRun(stats: Stats, run: GameRun, today: string = dayKey()): Stats {
  const runs = [...stats.runs, run].slice(-MAX_RUNS);
  let next: Stats = { ...stats, runs };
  next = recordAnswers(next, run.answers.map((a) => ({ qid: a.qid, correct: a.correct, at: run.endedAt })));
  next = pushRecent(next, run.category, run.answers.map((a) => a.qid));
  return touchDaily(next, today);
}

export function recordExam(stats: Stats, exam: ExamResult, today: string = dayKey()): Stats {
  const exams = [...stats.exams, exam].slice(-MAX_EXAMS);
  let next: Stats = { ...stats, exams };
  next = recordAnswers(
    next,
    exam.answers.filter((a) => a.chosen !== null).map((a) => ({ qid: a.qid, correct: a.correct, at: exam.endedAt })),
  );
  return touchDaily(next, today);
}

export function recordAnswers(stats: Stats, answers: { qid: string; correct: boolean; at: number }[]): Stats {
  if (answers.length === 0) return stats;
  const questions = { ...stats.questions };
  for (const a of answers) {
    if (a.qid.startsWith('sign:')) continue; // synthetic sign prompts are not tracked per question
    const prev: QuestionStat = questions[a.qid] ?? { seen: 0, correct: 0, wrong: 0, lastSeen: 0, box: 0 };
    const box = a.correct ? (Math.min(4, prev.box + 1) as QuestionStat['box']) : 0;
    questions[a.qid] = {
      seen: prev.seen + 1,
      correct: prev.correct + (a.correct ? 1 : 0),
      wrong: prev.wrong + (a.correct ? 0 : 1),
      lastSeen: a.at,
      lastWrong: a.correct ? prev.lastWrong : a.at,
      box,
    };
  }
  return { ...stats, questions };
}

export function pushRecent(stats: Stats, category: StreakCategory, ids: string[]): Stats {
  const prev = stats.recent[category] ?? [];
  const merged = [...prev.filter((id) => !ids.includes(id)), ...ids].slice(-RECENT_PER_CATEGORY);
  return { ...stats, recent: { ...stats.recent, [category]: merged } };
}

function runDay(run: GameRun): string {
  return dayKey(new Date(run.endedAt));
}

export function runsFor(stats: Stats, category: StreakCategory | 'all'): GameRun[] {
  return category === 'all' ? stats.runs : stats.runs.filter((r) => r.category === category);
}

export function bestToday(stats: Stats, category: StreakCategory | 'all', today: string = dayKey()): number {
  return runsFor(stats, category)
    .filter((r) => runDay(r) === today)
    .reduce((m, r) => Math.max(m, r.score), 0);
}

export function personalBest(stats: Stats, category: StreakCategory | 'all'): number {
  return runsFor(stats, category).reduce((m, r) => Math.max(m, r.score), 0);
}

export function longestStreak(stats: Stats, category: StreakCategory | 'all'): number {
  return runsFor(stats, category).reduce((m, r) => Math.max(m, r.correct), 0);
}

export interface LeaderboardRow {
  rank: number;
  run: GameRun;
}

export function leaderboard(
  stats: Stats,
  category: StreakCategory | 'all',
  scope: 'today' | 'all',
  limit = 10,
  today: string = dayKey(),
): LeaderboardRow[] {
  return runsFor(stats, category)
    .filter((r) => (scope === 'today' ? runDay(r) === today : true))
    .sort((a, b) => b.score - a.score || b.correct - a.correct || a.endedAt - b.endedAt)
    .slice(0, limit)
    .map((run, i) => ({ rank: i + 1, run }));
}

export function accuracyByCategory(stats: Stats, categoryOf: (qid: string) => Category | undefined): Record<Category, { seen: number; correct: number }> {
  const out = {} as Record<Category, { seen: number; correct: number }>;
  for (const [qid, s] of Object.entries(stats.questions)) {
    const c = categoryOf(qid);
    if (!c) continue;
    const row = (out[c] ??= { seen: 0, correct: 0 });
    row.seen += s.seen;
    row.correct += s.correct;
  }
  return out;
}

export function wrongBank(stats: Stats): string[] {
  return Object.entries(stats.questions)
    .filter(([, s]) => s.wrong > 0 && s.box < 3)
    .sort((a, b) => (b[1].lastWrong ?? 0) - (a[1].lastWrong ?? 0))
    .map(([id]) => id);
}
