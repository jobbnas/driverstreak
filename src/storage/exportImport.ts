import type { Stats } from '@/types';
import { migrate } from './store';
import { dayKey } from './stats';

export function exportStats(stats: Stats): void {
  const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `driverstreak-${dayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function parseImport(text: string): Stats {
  const parsed: unknown = JSON.parse(text);
  const stats = migrate(parsed);
  if ((parsed as { version?: unknown })?.version !== 1) throw new Error('Okänt filformat');
  return stats;
}

/** Merges imported data into current: unions runs/exams by id, keeps max question stats, longest daily streak. */
export function mergeStats(current: Stats, incoming: Stats): Stats {
  const byId = <T extends { id: string }>(a: T[], b: T[]) => {
    const m = new Map<string, T>();
    for (const x of [...a, ...b]) m.set(x.id, x);
    return [...m.values()].sort((x, y) => (x as unknown as { endedAt: number }).endedAt - (y as unknown as { endedAt: number }).endedAt);
  };
  const questions = { ...current.questions };
  for (const [id, s] of Object.entries(incoming.questions)) {
    const c = questions[id];
    if (!c || s.lastSeen > c.lastSeen) questions[id] = s;
  }
  const daily = current.daily.lastDay >= incoming.daily.lastDay ? current.daily : incoming.daily;
  const best = { ...current.parking.best };
  for (const [id, r] of Object.entries(incoming.parking.best)) {
    const c = best[id];
    if (!r) continue;
    best[id] = c
      ? {
          stars: Math.max(c.stars, r.stars) as 0 | 1 | 2 | 3,
          bestMoves: Math.min(c.bestMoves ?? Infinity, r.bestMoves ?? Infinity) === Infinity ? undefined : Math.min(c.bestMoves ?? Infinity, r.bestMoves ?? Infinity),
          bestTimeMs: Math.min(c.bestTimeMs ?? Infinity, r.bestTimeMs ?? Infinity) === Infinity ? undefined : Math.min(c.bestTimeMs ?? Infinity, r.bestTimeMs ?? Infinity),
          attempts: c.attempts + r.attempts,
          completions: c.completions + r.completions,
          scratches: c.scratches + r.scratches,
        }
      : r;
  }
  return {
    ...current,
    runs: byId(current.runs, incoming.runs).slice(-300),
    exams: byId(current.exams, incoming.exams).slice(-50),
    questions,
    daily: { ...daily, longest: Math.max(current.daily.longest, incoming.daily.longest) },
    parking: {
      best,
      badges: [...new Set([...current.parking.badges, ...incoming.parking.badges])],
      damageKr: Math.max(current.parking.damageKr, incoming.parking.damageKr),
      curbStreak: current.parking.curbStreak,
    },
  };
}
