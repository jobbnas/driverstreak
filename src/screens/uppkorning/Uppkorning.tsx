import { useMemo, useState } from 'preact/hooks';
import { BackHeader } from '@/ui/BackHeader';
import { navigate, route } from '@/router';
import { HOTSPOT_STYLE, provet, sakItems, uppsala, type Hotspot, type SakItem } from './data';
import { UppsalaMap } from './UppsalaMap';
import { mulberry32, shuffle } from '@/engine/rng';
import '@/styles/uppkorning.css';

export function UppkorningRoutes() {
  const sub = route.value.parts[1];
  if (sub === 'provet') return <ProvetScreen />;
  if (sub === 'sakerhetskontroll') return <SakScreen />;
  if (sub === 'uppsala') return <UppsalaScreen />;
  return <Hub />;
}

function Hub() {
  return (
    <div class="page">
      <BackHeader />
      <h1 class="page-title">Uppkörning</h1>
      <p class="page-subtitle">Körprov B i Uppsala: vad som bedöms, säkerhetskontrollen och var du kommer att få köra.</p>
      <div class="home-grid" style={{ marginTop: 22 }}>
        <button class="home-card" onClick={() => navigate('/uppkorning/uppsala')}>
          <span class="emoji">🗺️</span>
          <span>
            <h2>Uppsala – rutter och platser</h2>
            <p>Kontoret på Hållnäsgatan, de sex vanliga slingorna och 17 platser på kartan.</p>
          </span>
          <span class="chev">›</span>
        </button>
        <button class="home-card" onClick={() => navigate('/uppkorning/sakerhetskontroll')}>
          <span class="emoji">🔧</span>
          <span>
            <h2>Säkerhetskontroll</h2>
            <p>25 kontrollpunkter: hur du gör, varför, och vad du säger om något är fel. Med förhörsläge.</p>
          </span>
          <span class="chev">›</span>
        </button>
        <button class="home-card" onClick={() => navigate('/uppkorning/provet')}>
          <span class="emoji">📋</span>
          <span>
            <h2>Så bedöms provet</h2>
            <p>Trafikverkets tre delar och 19 moment, plus vad som fäller.</p>
          </span>
          <span class="chev">›</span>
        </button>
        <button class="home-card" onClick={() => navigate('/streak?cat=uppkorning')}>
          <span class="emoji">⚡️</span>
          <span>
            <h2>Streak: Uppkörning</h2>
            <p>Snabbfrågor om säkerhetskontroll, manövrering, bedömning och Uppsala.</p>
          </span>
          <span class="chev">›</span>
        </button>
        <button class="home-card" onClick={() => navigate('/practice/run?cat=uppkorning&n=20')}>
          <span class="emoji">🎯</span>
          <span>
            <h2>Öva uppkörningsfrågor</h2>
            <p>20 frågor i lugn takt med förklaringar.</p>
          </span>
          <span class="chev">›</span>
        </button>
      </div>
    </div>
  );
}

function ProvetScreen() {
  return (
    <div class="page">
      <BackHeader to="/uppkorning" />
      <h1 class="page-title">Så bedöms provet</h1>
      <p class="page-subtitle">{provet.intro}</p>
      <div class="stack" style={{ marginTop: 22 }}>
        {provet.parts.map((p) => (
          <div class="card" key={p.title}>
            <h2 class="uk-h2">{p.title}</h2>
            <p class="uk-text">{p.text}</p>
          </div>
        ))}
      </div>
      <h2 class="section-title">Momenten i trafik</h2>
      <div class="card">
        {provet.moments.map((m) => (
          <details class="uk-details" key={m.title}>
            <summary>{m.title}</summary>
            <p class="uk-text">{m.text}</p>
          </details>
        ))}
      </div>
      <h2 class="section-title">Vad som fäller – och inte</h2>
      <div class="card">
        <ul class="rules">
          {provet.verdict.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function SakScreen() {
  const [mode, setMode] = useState<'lista' | 'forhor'>('lista');
  const groups = useMemo(() => {
    const m = new Map<string, SakItem[]>();
    for (const it of sakItems) m.set(it.group, [...(m.get(it.group) ?? []), it]);
    return [...m.entries()];
  }, []);
  return (
    <div class="page">
      <BackHeader to="/uppkorning" />
      <h1 class="page-title">Säkerhetskontroll</h1>
      <p class="page-subtitle">Prövaren väljer några punkter. Visa hur, förklara varför, och föreslå åtgärd om något är fel.</p>
      <div class="pill-row" style={{ justifyContent: 'center', marginTop: 16 }}>
        <button class="pill" aria-pressed={mode === 'lista'} onClick={() => setMode('lista')}>Checklista</button>
        <button class="pill" aria-pressed={mode === 'forhor'} onClick={() => setMode('forhor')}>Förhör mig</button>
      </div>
      {mode === 'lista' ? (
        groups.map(([group, items]) => (
          <section key={group}>
            <h2 class="section-title" style={{ textAlign: 'left', fontSize: 18 }}>{group}</h2>
            <div class="card" style={{ padding: '4px 20px' }}>
              {items.map((it) => (
                <details class="uk-details" key={it.id}>
                  <summary>{it.title}</summary>
                  <p class="uk-label">Så gör du</p>
                  <p class="uk-text">{it.how}</p>
                  <p class="uk-label">Varför</p>
                  <p class="uk-text">{it.why}</p>
                  <p class="uk-label">Om något är fel</p>
                  <p class="uk-text">{it.fault}</p>
                </details>
              ))}
            </div>
          </section>
        ))
      ) : (
        <Forhor />
      )}
    </div>
  );
}

function Forhor() {
  const [seed, setSeed] = useState(() => Date.now() & 0xffff);
  const order = useMemo(() => shuffle(sakItems, mulberry32(seed)), [seed]);
  const [i, setI] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [known, setKnown] = useState(0);
  const item = order[i];
  if (!item) {
    return (
      <div class="card center" style={{ marginTop: 16 }}>
        <h2 class="uk-h2">Klart!</h2>
        <p class="uk-text">Du kunde {known} av {order.length} punkter utan att titta.</p>
        <button class="btn btn-primary" style={{ marginTop: 14 }} onClick={() => { setSeed(Date.now() & 0xffff); setI(0); setKnown(0); setReveal(false); }}>Kör igen</button>
      </div>
    );
  }
  const next = (k: boolean) => {
    if (k) setKnown((n) => n + 1);
    setReveal(false);
    setI((n) => n + 1);
  };
  return (
    <div class="card" style={{ marginTop: 16 }}>
      <p class="muted" style={{ fontSize: 13 }}>{i + 1} / {order.length} · {item.group}</p>
      <h2 class="uk-h2" style={{ marginTop: 6 }}>"Kan du visa hur du kontrollerar {item.title.toLowerCase()}, och varför?"</h2>
      {!reveal ? (
        <button class="btn btn-primary" style={{ marginTop: 18 }} onClick={() => setReveal(true)}>Visa svar</button>
      ) : (
        <>
          <p class="uk-label">Så gör du</p>
          <p class="uk-text">{item.how}</p>
          <p class="uk-label">Varför</p>
          <p class="uk-text">{item.why}</p>
          <p class="uk-label">Om något är fel</p>
          <p class="uk-text">{item.fault}</p>
          <div class="stat-row" style={{ marginTop: 16 }}>
            <button class="btn btn-surface" onClick={() => next(false)}>Behöver öva</button>
            <button class="btn btn-primary" onClick={() => next(true)}>Kunde det</button>
          </div>
        </>
      )}
    </div>
  );
}

function UppsalaScreen() {
  const [selected, setSelected] = useState<Hotspot | undefined>();
  const [tab, setTab] = useState<'slingor' | 'platser' | 'faror' | 'tips'>('slingor');
  const g = uppsala;
  return (
    <div class="page">
      <BackHeader to="/uppkorning" />
      <h1 class="page-title">Uppkörning i Uppsala</h1>
      <p class="page-subtitle">Analys av var Trafikverket låter dig köra, byggd på Trafikverkets information, kandidatberättelser 2022–2026 och kartdata.</p>

      <div class="card" style={{ marginTop: 20 }}>
        <h2 class="uk-h2">{g.office.name}</h2>
        <p class="uk-text"><b>{g.office.address}</b><br />{g.office.district}</p>
        <p class="uk-text muted" style={{ fontSize: 13 }}>{g.office.hours}</p>
        <a class="pill pill-small" style={{ display: 'inline-block', marginTop: 8, textDecoration: 'none' }} href={`https://maps.apple.com/?q=${encodeURIComponent(g.office.address)}&ll=${g.office.lat},${g.office.lon}`} target="_blank" rel="noopener">Öppna i Kartor</a>
        <ul class="rules" style={{ marginTop: 12 }}>
          {g.office.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
        <p class="uk-text" style={{ marginTop: 10 }}><b>Statistik:</b> {g.stats.passRate}</p>
      </div>

      <h2 class="section-title">Karta</h2>
      <UppsalaMap hotspots={g.hotspots} selected={selected} onSelect={setSelected} />
      <div class="legend">
        {Object.entries(HOTSPOT_STYLE).map(([k, v]) => (
          <span key={k} class="legend-item"><span class="dot" style={{ background: v.color }} />{v.label}</span>
        ))}
      </div>
      {selected && (
        <div class="card" style={{ marginTop: 10 }}>
          <h3 class="uk-h3">{selected.name}</h3>
          <p class="uk-text">{selected.note}</p>
          <a class="pill pill-small" style={{ display: 'inline-block', marginTop: 8, textDecoration: 'none' }} href={`https://maps.apple.com/?ll=${selected.lat},${selected.lon}&q=${encodeURIComponent(selected.name)}`} target="_blank" rel="noopener">Öppna i Kartor</a>
        </div>
      )}

      <div class="card" style={{ marginTop: 18 }}>
        <h2 class="uk-h2">{g.start.title}</h2>
        <ol class="rules">
          {g.start.items.map((t) => <li key={t}>{t}</li>)}
        </ol>
      </div>

      <div class="pill-row" style={{ marginTop: 20, justifyContent: 'center' }}>
        <button class="pill" aria-pressed={tab === 'slingor'} onClick={() => setTab('slingor')}>Slingor</button>
        <button class="pill" aria-pressed={tab === 'platser'} onClick={() => setTab('platser')}>Platser</button>
        <button class="pill" aria-pressed={tab === 'faror'} onClick={() => setTab('faror')}>Uppsala-fällor</button>
        <button class="pill" aria-pressed={tab === 'tips'} onClick={() => setTab('tips')}>Tips</button>
      </div>

      {tab === 'slingor' && (
        <div class="stack">
          {g.loops.map((l, idx) => (
            <div class="card" key={l.id}>
              <p class="muted" style={{ fontSize: 12 }}>Slinga {idx + 1} · {l.share}</p>
              <h3 class="uk-h3">{l.title}</h3>
              <ol class="rules">
                {l.steps.map((s) => <li key={s}>{s}</li>)}
              </ol>
              <p class="uk-label">Det prövaren tittar på här</p>
              <ul class="rules">
                {l.watch.map((w) => <li key={w}>{w}</li>)}
              </ul>
            </div>
          ))}
        </div>
      )}
      {tab === 'platser' && (
        <div class="leaderboard">
          {g.hotspots.map((h) => (
            <button key={h.name} class="leaderboard-row" style={{ width: '100%', textAlign: 'left', alignItems: 'center' }} onClick={() => { setSelected(h); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
              <span class="who"><span class="dot" style={{ background: HOTSPOT_STYLE[h.type].color, display: 'inline-block', width: 10, height: 10, borderRadius: 5, marginRight: 8 }} />{h.name}</span>
              <span class="muted" style={{ fontSize: 12 }}>{HOTSPOT_STYLE[h.type].label}</span>
            </button>
          ))}
        </div>
      )}
      {tab === 'faror' && (
        <div class="stack">
          {g.hazards.map((h) => (
            <div class="card" key={h.title}>
              <h3 class="uk-h3">{h.title}</h3>
              <p class="uk-text">{h.text}</p>
            </div>
          ))}
        </div>
      )}
      {tab === 'tips' && (
        <div class="card">
          <ul class="rules">
            {g.tips.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
      )}

      <details class="uk-details" style={{ marginTop: 20 }}>
        <summary class="muted">Källor och förbehåll</summary>
        <ul class="rules" style={{ fontSize: 13 }}>
          {g.sources.map((s) => <li key={s}>{s}</li>)}
        </ul>
        <p class="uk-text muted" style={{ fontSize: 13 }}>Det finns ingen fast provrutt – prövaren väljer väg under provet. Slingorna är de som återkommer i kandidaternas berättelser efter flytten 2022. Positioner markerade "ungefärlig" är uppskattade från kartan.</p>
      </details>
    </div>
  );
}
