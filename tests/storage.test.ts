import { describe, expect, it } from 'vitest';
import { loadStats, migrate, saveStats, type StorageLike } from '@/storage/store';
import { mergeStats, parseImport } from '@/storage/exportImport';
import { defaultStats, STORAGE_KEY } from '@/storage/stats';

function mem(): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v), removeItem: (k) => void map.delete(k) };
}

describe('storage', () => {
  it('returns defaults for missing or corrupt data', () => {
    const s = mem();
    expect(loadStats(s)).toEqual(defaultStats());
    s.setItem(STORAGE_KEY, '{not json');
    expect(loadStats(s)).toEqual(defaultStats());
    expect(migrate({ version: 99 })).toEqual(defaultStats());
  });
  it('round-trips and fills missing fields', () => {
    const s = mem();
    const stats = defaultStats();
    stats.settings.haptics = false;
    saveStats(stats, s);
    const loaded = loadStats(s);
    expect(loaded.settings.haptics).toBe(false);
    expect(loaded.settings.textTimerSec).toBe(20);
  });
  it('trims history when quota is exceeded', () => {
    let calls = 0;
    const s: StorageLike = {
      getItem: () => null,
      setItem: (_k, v) => {
        calls++;
        if (calls === 1) throw new Error('QuotaExceededError');
        expect(JSON.parse(v).runs.length).toBeLessThanOrEqual(50);
      },
      removeItem: () => undefined,
    };
    const stats = defaultStats();
    stats.runs = Array.from({ length: 120 }, (_, i) => ({
      id: `r${i}`, mode: 'streak', category: 'vagmarken', variant: 'name2img', startedAt: i, endedAt: i, score: i, bonus: 0, correct: 1, endedBy: 'wrong', answers: [],
    }));
    saveStats(stats, s);
    expect(calls).toBe(2);
  });
  it('imports and merges', () => {
    const a = defaultStats();
    a.runs = [{ id: 'x', mode: 'streak', category: 'vagmarken', variant: 'name2img', startedAt: 1, endedAt: 1, score: 10, bonus: 0, correct: 1, endedBy: 'wrong', answers: [] }];
    a.daily = { current: 3, longest: 3, lastDay: '2026-01-03', days: [] };
    const b = parseImport(JSON.stringify(defaultStats()));
    b.runs = [
      { id: 'x', mode: 'streak', category: 'vagmarken', variant: 'name2img', startedAt: 1, endedAt: 1, score: 10, bonus: 0, correct: 1, endedBy: 'wrong', answers: [] },
      { id: 'y', mode: 'streak', category: 'miljo', variant: 'text', startedAt: 2, endedAt: 2, score: 20, bonus: 0, correct: 1, endedBy: 'wrong', answers: [] },
    ];
    b.daily = { current: 1, longest: 7, lastDay: '2025-12-01', days: [] };
    const m = mergeStats(a, b);
    expect(m.runs.map((r) => r.id)).toEqual(['x', 'y']);
    expect(m.daily.current).toBe(3);
    expect(m.daily.longest).toBe(7);
    expect(() => parseImport('{"version":2}')).toThrow();
  });
});
