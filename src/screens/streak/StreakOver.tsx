import { Sheet } from '@/ui/Sheet';
import { Leaderboard } from '@/ui/Leaderboard';
import { fmt } from '@/format';
import type { GameRun, Stats } from '@/types';
import { leaderboard } from '@/storage/stats';
import { signUrl, questionById, signByCode } from '@/content';

export interface OverInfo {
  run: GameRun;
  isNewRecord: boolean;
  previousBest: number;
  bestToday: number;
  lastPrompt?: { title: string; correctLabel: string; explanation?: string; image?: string; endedBy: GameRun['endedBy'] };
}

export function StreakOver(props: { info: OverInfo; stats: Stats; onAgain: () => void; onClose: () => void }) {
  const { run, isNewRecord, previousBest, bestToday, lastPrompt } = props.info;
  const rows = leaderboard(props.stats, run.category, 'all', 10);
  const sub = isNewRecord
    ? previousBest > 0
      ? `Ditt gamla rekord var ${fmt(previousBest)}`
      : 'Ditt första resultat är sparat'
    : `Ditt dagsbästa är ${fmt(bestToday)}`;
  return (
    <Sheet onClose={props.onClose} label="Resultat">
      <div class="over">
        <h1 class="over-title">{isNewRecord ? 'Nytt rekord!' : run.correct >= 10 ? 'Snyggt jobbat!' : 'Bra kämpat!'}</h1>
        <div class="over-score">{fmt(run.score)}</div>
        <p class="over-sub">{sub}</p>
        <div class="over-card">
          <p class="big">
            {run.correct} rätt i rad{run.bonus > 0 ? ` · ${fmt(run.bonus)} bonuspoäng` : ''}
          </p>
          <p class="small">
            {run.endedBy === 'timeout' ? 'Tiden tog slut.' : run.endedBy === 'wrong' ? 'Ett fel avslutade omgången.' : 'Omgången avslutades.'}
          </p>
        </div>
        {lastPrompt && run.endedBy !== 'quit' && (
          <div class="answer-review">
            <p class="q">{lastPrompt.title}</p>
            <p>
              Rätt svar: <span class="ok">{lastPrompt.correctLabel}</span>
            </p>
            {lastPrompt.image && (
              <img class="review-sign" src={signUrl(lastPrompt.image)} alt="" />
            )}
            {lastPrompt.explanation && <p class="expl">{lastPrompt.explanation}</p>}
          </div>
        )}
        <h2 class="section-title" style={{ marginBottom: 10 }}>
          Topplista
        </h2>
        <div class="over-board">
          <Leaderboard rows={rows} highlightId={run.id} />
        </div>
        <div class="over-actions">
          <button class="btn btn-primary" onClick={props.onAgain}>
            Spela igen
          </button>
          <button class="btn btn-ghost" onClick={props.onClose}>
            Avsluta
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function describeLastPrompt(run: GameRun, promptTitle: string, correctLabel: string, explanation?: string, image?: string): OverInfo['lastPrompt'] {
  return { title: promptTitle, correctLabel, explanation, image, endedBy: run.endedBy };
}

export { questionById, signByCode };
