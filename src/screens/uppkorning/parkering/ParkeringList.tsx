import { BackHeader } from '@/ui/BackHeader';
import { navigate } from '@/router';
import { store } from '@/store';
import { fmt, fmtClock } from '@/format';
import { SCENARIOS, MAX_STARS } from '@/engine/parking/scenarios';
import { BADGES } from '@/engine/parking/feedback';
import { parkingStarTotal } from '@/storage/stats';
import { Stars } from './ReportCard';

export function ParkeringList() {
  const stats = store.stats.value;
  const total = parkingStarTotal(stats);
  const firstOpen = SCENARIOS.find((s) => (stats.parking.best[s.id]?.stars ?? 0) === 0);
  return (
    <div class="page">
      <BackHeader to="/uppkorning" />
      <h1 class="page-title">Parkering</h1>
      <p class="page-subtitle">3D-simulator med riktig Octavia-geometri. Öva fickparkering, rutor och backning runt hörnet.</p>
      <div class="stat-row" style={{ marginTop: 20 }}>
        <div class="stat-card">
          <div class="stat-value">{total} / {MAX_STARS}</div>
          <div class="stat-label">Stjärnor</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{fmt(stats.parking.damageKr)} kr</div>
          <div class="stat-label">Skadekonto</div>
        </div>
      </div>
      {stats.parking.badges.length > 0 && (
        <div class="pk-badges" style={{ marginTop: 12 }}>
          {stats.parking.badges.map((id) => (
            <span key={id} class="pk-badge" title={BADGES.find((b) => b.id === id)?.description}>
              🏅 {BADGES.find((b) => b.id === id)?.title ?? id}
            </span>
          ))}
        </div>
      )}
      <div class="home-grid" style={{ marginTop: 18 }}>
        {SCENARIOS.map((s) => {
          const r = stats.parking.best[s.id];
          return (
            <button key={s.id} class="home-card" onClick={() => navigate(`/uppkorning/parkering/${s.id}`)}>
              <span class="emoji">{s.emoji}</span>
              <span style={{ flex: 1 }}>
                <h2>
                  {s.order}. {s.title}
                  {firstOpen?.id === s.id && <span class="pill pill-small" style={{ marginLeft: 8, background: 'var(--green)', color: 'var(--green-ink)' }}>Nästa</span>}
                </h2>
                <p>{s.subtitle}</p>
                <p style={{ marginTop: 6 }}>
                  <Stars n={r?.stars ?? 0} size={16} />
                  {r?.bestMoves !== undefined && <span class="muted" style={{ fontSize: 12, marginLeft: 8 }}>Bästa: {r.bestMoves} drag{r.bestTimeMs ? `, ${fmtClock(r.bestTimeMs)}` : ''}</span>}
                  {r && r.attempts > 0 && r.completions === 0 && <span class="muted" style={{ fontSize: 12, marginLeft: 8 }}>{r.attempts} försök</span>}
                </p>
              </span>
              <span class="chev">›</span>
            </button>
          );
        })}
      </div>
      <p class="muted center" style={{ marginTop: 20, fontSize: 13 }}>Tangentbord: pilar styr och gasar, R/N/D växlar, V byter vy, B tittar bakåt. På telefon: ratt och pedaler på skärmen.</p>
    </div>
  );
}
