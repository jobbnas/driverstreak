import { useRef, useState } from 'preact/hooks';
import { BackHeader } from '@/ui/BackHeader';
import { applyMotionSetting, store } from '@/store';
import { exportStats, mergeStats, parseImport } from '@/storage/exportImport';

export function Settings() {
  const stats = store.stats.value;
  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | undefined>();
  const [confirmReset, setConfirmReset] = useState(false);
  const set = (fn: (s: typeof stats.settings) => typeof stats.settings) => {
    store.update((s) => ({ ...s, settings: fn(s.settings) }));
    applyMotionSetting();
  };
  const onFile = async (e: Event) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    try {
      const incoming = parseImport(await f.text());
      store.update((s) => mergeStats(s, incoming));
      store.flush();
      setMsg('Importen lyckades.');
    } catch (err) {
      setMsg(`Kunde inte importera: ${(err as Error).message}`);
    }
  };
  return (
    <div class="page">
      <BackHeader />
      <h1 class="page-title">Inställningar</h1>
      <div class="card" style={{ marginTop: 20 }}>
        <div class="toggle-row">
          <span>Vibration vid svar</span>
          <button class="switch" role="switch" aria-checked={stats.settings.haptics} onClick={() => set((s) => ({ ...s, haptics: !s.haptics }))} aria-label="Vibration" />
        </div>
        <div class="toggle-row">
          <span>Rörelse/animationer</span>
          <div class="pill-row" style={{ padding: 0 }}>
            {(['auto', 'on', 'off'] as const).map((m) => (
              <button key={m} class="pill pill-small" aria-pressed={stats.settings.reducedMotion === m} onClick={() => set((s) => ({ ...s, reducedMotion: m }))}>
                {m === 'auto' ? 'Auto' : m === 'on' ? 'På' : 'Av'}
              </button>
            ))}
          </div>
        </div>
        <div class="toggle-row">
          <span>Tid per textfråga i Streak</span>
          <div class="pill-row" style={{ padding: 0 }}>
            {[15, 20, 30].map((sec) => (
              <button key={sec} class="pill pill-small" aria-pressed={stats.settings.textTimerSec === sec} onClick={() => set((s) => ({ ...s, textTimerSec: sec }))}>
                {sec} s
              </button>
            ))}
          </div>
        </div>
      </div>
      <h2 class="section-title">Data</h2>
      <div class="stack">
        <button class="btn btn-surface" onClick={() => exportStats(store.stats.value)}>Exportera statistik (JSON)</button>
        <button class="btn btn-surface" onClick={() => fileRef.current?.click()}>Importera statistik</button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onFile} />
        {!confirmReset ? (
          <button class="btn btn-danger" onClick={() => setConfirmReset(true)}>Nollställ all statistik</button>
        ) : (
          <div class="card">
            <p>Vill du verkligen radera alla omgångar, prov och statistik?</p>
            <div class="stack" style={{ marginTop: 12 }}>
              <button class="btn btn-danger" onClick={() => { store.reset(); setConfirmReset(false); setMsg('Statistiken är nollställd.'); }}>Ja, radera</button>
              <button class="btn btn-ghost" onClick={() => setConfirmReset(false)}>Avbryt</button>
            </div>
          </div>
        )}
        {msg && <p class="muted center">{msg}</p>}
      </div>
      <h2 class="section-title">Om</h2>
      <div class="card muted" style={{ fontSize: 14, lineHeight: 1.5 }}>
        <p>DriverStreak är ett inofficiellt övningsverktyg för kunskapsprovet, behörighet B. Frågorna är skrivna för övning och kan innehålla fel – kontrollera alltid mot Transportstyrelsen och Körkortsboken.</p>
        <p style={{ marginTop: 10 }}>Vägmärkesbilder: Transportstyrelsen via Wikimedia Commons (public domain). Spelidén är inspirerad av Trafikos vägmärkesspel.</p>
        <p style={{ marginTop: 10 }}>Version {__APP_VERSION__}</p>
      </div>
    </div>
  );
}
