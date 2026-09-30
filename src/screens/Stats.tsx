import { useEffect, useState } from 'preact/hooks';
import { BackHeader } from '@/ui/BackHeader';
import { StatCard } from '@/ui/Leaderboard';
import { store } from '@/store';
import { accuracyByCategory, currentDailyStreak, dayKey, longestStreak, personalBest } from '@/storage/stats';
import { CATEGORIES, CATEGORY_LABEL, type Category, type Question } from '@/types';
import { loadAllQuestions } from '@/content';
import { fmtDate } from '@/format';
import { navigate } from '@/router';

function lastWeeks(n: number): string[][] {
  const cols: string[][] = [];
  const today = new Date();
  const dow = (today.getDay() + 6) % 7; // Monday = 0
  const start = new Date(today);
  start.setDate(today.getDate() - dow - (n - 1) * 7);
  for (let w = 0; w < n; w++) {
    const col: string[] = [];
    for (let d = 0; d < 7; d++) {
      const dt = new Date(start);
      dt.setDate(start.getDate() + w * 7 + d);
      col.push(dayKey(dt));
    }
    cols.push(col);
  }
  return cols;
}

export function Stats() {
  const stats = store.stats.value;
  const [questions, setQuestions] = useState<Question[]>([]);
  useEffect(() => {
    loadAllQuestions().then(setQuestions);
  }, []);
  const byId = new Map(questions.map((q) => [q.id, q.category]));
  const acc = accuracyByCategory(stats, (id) => byId.get(id));
  const days = new Set(stats.daily.days);
  const today = dayKey();
  const seen = Object.keys(stats.questions).length;
  return (
    <div class="page">
      <BackHeader />
      <h1 class="page-title">Statistik</h1>
      <div class="stat-row" style={{ marginTop: 20 }}>
        <StatCard value={`${currentDailyStreak(stats)} dagar`} label="Dagsstreak" />
        <StatCard value={`${stats.daily.longest} dagar`} label="Längsta dagsstreak" />
        <StatCard value={personalBest(stats, 'all')} label="Bästa poäng" />
        <StatCard value={longestStreak(stats, 'all')} label="Flest rätt i rad" />
      </div>
      <h2 class="section-title">Senaste 8 veckorna</h2>
      <div class="card">
        <div class="calendar">
          {lastWeeks(8).map((col, i) => (
            <div class="cal-col" key={i}>
              {col.map((d) => (
                <div key={d} class={`cal-day${days.has(d) ? ' on' : ''}${d === today ? ' today' : ''}`} title={d} />
              ))}
            </div>
          ))}
        </div>
      </div>
      <h2 class="section-title">Träffsäkerhet per ämne</h2>
      <div class="card">
        {CATEGORIES.map((c: Category) => {
          const row = acc[c];
          const pct = row && row.seen > 0 ? Math.round((row.correct / row.seen) * 100) : null;
          return (
            <div class="area-row" key={c}>
              <div class="area-head">
                <span>{CATEGORY_LABEL[c]}</span>
                <span class="muted">{pct === null ? '–' : `${pct}% · ${row!.seen} svar`}</span>
              </div>
              <div class="area-bar"><div style={{ width: `${pct ?? 0}%` }} /></div>
            </div>
          );
        })}
        <p class="muted" style={{ fontSize: 13, marginTop: 10 }}>{seen} frågor besvarade totalt · {stats.runs.length} streak-omgångar · {stats.exams.length} prov</p>
      </div>
      {stats.exams.length > 0 && (
        <>
          <h2 class="section-title">Provhistorik</h2>
          <div class="leaderboard">
            {[...stats.exams].reverse().map((e) => (
              <button key={e.id} class="leaderboard-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/exam/result/${e.id}`)}>
                <span class="who">{e.passed ? 'Godkänd' : 'Underkänd'}<span class="meta">{fmtDate(e.endedAt)}</span></span>
                <span class="score">{e.correct}/{e.total}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
