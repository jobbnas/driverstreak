import { describe, expect, it } from 'vitest';
import {
  bestToday,
  currentDailyStreak,
  dayKey,
  defaultStats,
  leaderboard,
  personalBest,
  previousDayKey,
  recordRun,
  touchDaily,
  wrongBank,
  recordAnswers,
} from '@/storage/stats';
import type { GameRun } from '@/types';

function run(score: number, endedAt: number, category: GameRun['category'] = 'vagmarken', correct = 3): GameRun {
  return {
    id: `r${score}-${endedAt}`,
    mode: 'streak',
    category,
    variant: 'name2img',
    startedAt: endedAt - 30000,
    endedAt,
    score,
    bonus: 0,
    correct,
    endedBy: 'wrong',
    answers: [
      { qid: 'tr-vaj-001', ms: 500, correct: true, points: 1100 },
      { qid: 'sign:A1:name2img', ms: 500, correct: true, points: 1100 },
      { qid: 'tr-vaj-002', ms: 500, correct: false, points: 0 },
    ],
  };
}

describe('day keys', () => {
  it('formats local dates and steps back across month and year boundaries', () => {
    expect(dayKey(new Date(2026, 0, 1))).toBe('2026-01-01');
    expect(previousDayKey('2026-01-01')).toBe('2025-12-31');
    expect(previousDayKey('2026-03-01')).toBe('2026-02-28');
    // DST switch in Sweden 2026-03-29
    expect(previousDayKey('2026-03-30')).toBe('2026-03-29');
    expect(previousDayKey('2026-10-26')).toBe('2026-10-25');
  });
});

describe('daily streak', () => {
  it('increments on consecutive days and resets after a gap', () => {
    let s = defaultStats();
    s = touchDaily(s, '2026-05-01');
    expect(s.daily.current).toBe(1);
    s = touchDaily(s, '2026-05-01');
    expect(s.daily.current).toBe(1);
    s = touchDaily(s, '2026-05-02');
    expect(s.daily.current).toBe(2);
    expect(currentDailyStreak(s, '2026-05-03')).toBe(2);
    expect(currentDailyStreak(s, '2026-05-04')).toBe(0);
    s = touchDaily(s, '2026-05-05');
    expect(s.daily.current).toBe(1);
    expect(s.daily.longest).toBe(2);
  });
});

describe('runs and leaderboard', () => {
  it('tracks best today, personal best and leaderboard order', () => {
    const today = new Date(2026, 4, 10, 12).getTime();
    const yesterday = today - 86400000;
    let s = defaultStats();
    s = recordRun(s, run(5000, yesterday), '2026-05-09');
    s = recordRun(s, run(3000, today), '2026-05-10');
    s = recordRun(s, run(4000, today + 1000), '2026-05-10');
    expect(bestToday(s, 'vagmarken', '2026-05-10')).toBe(4000);
    expect(personalBest(s, 'vagmarken')).toBe(5000);
    expect(personalBest(s, 'trafikregler')).toBe(0);
    const lb = leaderboard(s, 'all', 'all', 10, '2026-05-10');
    expect(lb.map((r) => r.run.score)).toEqual([5000, 4000, 3000]);
    expect(leaderboard(s, 'all', 'today', 10, '2026-05-10').map((r) => r.run.score)).toEqual([4000, 3000]);
    expect(s.daily.current).toBe(2);
    expect(s.recent.vagmarken).toEqual(['tr-vaj-001', 'sign:A1:name2img', 'tr-vaj-002']);
  });
  it('tracks per-question stats and the wrong bank, ignoring synthetic sign prompts', () => {
    let s = defaultStats();
    s = recordRun(s, run(1000, Date.now()));
    expect(s.questions['sign:A1:name2img']).toBeUndefined();
    expect(s.questions['tr-vaj-001']?.box).toBe(1);
    expect(s.questions['tr-vaj-002']?.wrong).toBe(1);
    expect(wrongBank(s)).toEqual(['tr-vaj-002']);
    s = recordAnswers(s, [
      { qid: 'tr-vaj-002', correct: true, at: 1 },
      { qid: 'tr-vaj-002', correct: true, at: 2 },
      { qid: 'tr-vaj-002', correct: true, at: 3 },
    ]);
    expect(wrongBank(s)).toEqual([]);
  });
});
