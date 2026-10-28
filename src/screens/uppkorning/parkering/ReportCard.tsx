import type { Scenario } from '@/engine/parking/types';
import type { Finish } from './useParkingSim';
import { fmt, fmtClock } from '@/format';
import { remark, BADGES } from '@/engine/parking/feedback';

export function Stars(props: { n: number; size?: number }) {
  return (
    <span class="pk-stars" style={{ fontSize: props.size ?? 22 }} aria-label={`${props.n} av 3 stjärnor`}>
      {[1, 2, 3].map((i) => (
        <span key={i} class={i <= props.n ? 'on' : ''}>
          ★
        </span>
      ))}
    </span>
  );
}

export function ReportCard(props: { scenario: Scenario; finish: Finish; newBadges: string[]; seed: number; onAgain: () => void; onNext?: () => void; onList: () => void }) {
  const { finish, scenario } = props;
  const o = finish.outcome;
  const p = o.pose;
  const line = remark(o, finish.stars, scenario, props.seed);
  return (
    <div class="pk-report">
      <div class="pk-report-card">
        <p class="muted" style={{ fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Protokoll · {scenario.title}</p>
        <h2 class="pk-report-title">{o.failed ? 'Avbrutet' : finish.stars === 3 ? 'Godkänt med beröm' : finish.stars >= 1 ? 'Godkänt' : 'Inte riktigt'}</h2>
        <Stars n={finish.stars} size={34} />
        <p class="pk-remark">“{line}”</p>
        <div class="pk-report-grid">
          {p && (
            <>
              <div><span class="k">Vinkel</span><span class="v">{Math.abs(p.headingDeg).toFixed(1)}°</span></div>
              {p.curbDist !== undefined && p.curbDist < 3 && <div><span class="k">Till kantsten</span><span class="v">{Math.round(p.curbDist * 100)} cm</span></div>}
              {scenario.target?.bay && <div><span class="k">Centrering</span><span class="v">{Math.round(Math.abs(p.lat) * 100)} cm</span></div>}
              {!scenario.target?.bay && !scenario.target?.curb && <div><span class="k">I sidled</span><span class="v">{Math.round(Math.abs(p.lat) * 100)} cm</span></div>}
            </>
          )}
          <div><span class="k">Drag</span><span class="v">{o.moves}{scenario.rules.parMoves ? ` / par ${scenario.rules.parMoves}` : ''}</span></div>
          <div><span class="k">Kontakter</span><span class="v">{o.collisions}{scenario.rules.coneStars ? ` · koner ${o.conesHit}` : ''}</span></div>
          <div><span class="k">Skadekostnad</span><span class="v">{fmt(finish.damageKr)} kr</span></div>
          <div><span class="k">Tid</span><span class="v">{fmtClock(o.timeMs)}</span></div>
        </div>
        {props.newBadges.length > 0 && (
          <div class="pk-badges">
            {props.newBadges.map((id) => {
              const b = BADGES.find((x) => x.id === id);
              return (
                <span key={id} class="pk-badge new">
                  🏅 {b?.title ?? id}
                </span>
              );
            })}
          </div>
        )}
        <div class="stack" style={{ marginTop: 18 }}>
          <button class="btn btn-primary" onClick={props.onAgain}>Kör igen</button>
          {props.onNext && finish.stars >= 1 && <button class="btn btn-surface" onClick={props.onNext}>Nästa övning</button>}
          <button class="btn btn-ghost" onClick={props.onList}>Till listan</button>
        </div>
      </div>
    </div>
  );
}
