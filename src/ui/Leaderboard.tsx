import type { LeaderboardRow } from '@/storage/stats';
import { fmt, fmtDate, fmtTime } from '@/format';
import { CATEGORY_LABEL } from '@/types';

export function Leaderboard(props: { rows: LeaderboardRow[]; highlightId?: string; showCategory?: boolean; emptyText?: string }) {
  if (props.rows.length === 0) return <div class="leaderboard"><p class="empty">{props.emptyText ?? 'Inga omgångar än – spela för att hamna här.'}</p></div>;
  return (
    <div class="leaderboard">
      {props.rows.map(({ rank, run }) => (
        <div class="leaderboard-row" key={run.id} style={run.id === props.highlightId ? { color: 'var(--green)' } : undefined}>
          <span class="who">
            {rank}. {run.correct} i rad
            <span class="meta">
              {props.showCategory ? `${CATEGORY_LABEL[run.category]} · ` : ''}
              {fmtDate(run.endedAt)} {fmtTime(run.endedAt)}
            </span>
          </span>
          <span class="score">{fmt(run.score)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatCard(props: { value: string | number; label: string }) {
  return (
    <div class="stat-card">
      <div class="stat-value">{typeof props.value === 'number' ? fmt(props.value) : props.value}</div>
      <div class="stat-label">{props.label}</div>
    </div>
  );
}
