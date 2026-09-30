import { navigate } from '@/router';
import { store } from '@/store';
import { currentDailyStreak, personalBest } from '@/storage/stats';
import { StatCard } from '@/ui/Leaderboard';

export function Home() {
  const stats = store.stats.value;
  const streak = currentDailyStreak(stats);
  const isStandalone = typeof navigator !== 'undefined' && ((navigator as { standalone?: boolean }).standalone || matchMedia('(display-mode: standalone)').matches);
  return (
    <div class="page">
      <header class="page-header" style={{ justifyContent: 'space-between' }}>
        <div class="brand">
          <span class="dot" /> DriverStreak
        </div>
        <button class="icon-btn" aria-label="Inställningar" onClick={() => navigate('/settings')}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
          </svg>
        </button>
      </header>
      <div class="stat-row" style={{ marginBottom: 18 }}>
        <StatCard value={`${streak} ${streak === 1 ? 'dag' : 'dagar'}`} label="Dagsstreak" />
        <StatCard value={personalBest(stats, 'all')} label="Personbästa" />
      </div>
      <div class="home-grid">
        <button class="home-card" onClick={() => navigate('/streak')}>
          <span class="emoji">⚡️</span>
          <span>
            <h2>Streak</h2>
            <p>Trafiko-stilen: så många rätt i rad du kan, mot klockan.</p>
          </span>
          <span class="chev">›</span>
        </button>
        <button class="home-card" onClick={() => navigate('/exam')}>
          <span class="emoji">📝</span>
          <span>
            <h2>Övningsprov</h2>
            <p>65 frågor på 50 minuter, precis som hos Trafikverket.</p>
          </span>
          <span class="chev">›</span>
        </button>
        <button class="home-card" onClick={() => navigate('/practice')}>
          <span class="emoji">🎯</span>
          <span>
            <h2>Övning</h2>
            <p>Plugga per ämne i lugn takt med förklaringar. Repetera dina fel.</p>
          </span>
          <span class="chev">›</span>
        </button>
        <button class="home-card" onClick={() => navigate('/signs')}>
          <span class="emoji">🚸</span>
          <span>
            <h2>Skyltlexikon</h2>
            <p>Alla vägmärken med förklaring.</p>
          </span>
          <span class="chev">›</span>
        </button>
        <button class="home-card" onClick={() => navigate('/stats')}>
          <span class="emoji">📈</span>
          <span>
            <h2>Statistik</h2>
            <p>Träffsäkerhet per ämne, provhistorik och streaks.</p>
          </span>
          <span class="chev">›</span>
        </button>
      </div>
      {!isStandalone && (
        <p class="muted center" style={{ marginTop: 26, fontSize: 13 }}>
          Tips: lägg till på hemskärmen (Dela → Lägg till på hemskärmen) för helskärm och offlineläge.
        </p>
      )}
      <p class="muted center" style={{ marginTop: 14, fontSize: 12 }}>
        Inofficiellt övningsmaterial. Inte kopplat till Trafikverket eller Transportstyrelsen.
      </p>
    </div>
  );
}
