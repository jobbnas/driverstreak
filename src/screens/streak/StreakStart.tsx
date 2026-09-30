import { useMemo, useState } from 'preact/hooks';
import { CATEGORIES, CATEGORY_LABEL, type GameRun, type Question, type StreakCategory, type StreakVariant } from '@/types';
import { Leaderboard, StatCard } from '@/ui/Leaderboard';
import { bestToday, leaderboard, personalBest, recordRun } from '@/storage/stats';
import { store } from '@/store';
import { navigate } from '@/router';
import { quizzableSigns, loadAllQuestions } from '@/content';
import type { PromptSourceConfig } from '@/engine/prompts';
import type { GameState } from '@/engine/streakGame';
import { StreakGame } from './StreakGame';
import { StreakOver, type OverInfo } from './StreakOver';
import { useEffect } from 'preact/hooks';

const VARIANTS: { id: StreakVariant | 'mixed'; label: string }[] = [
  { id: 'name2img', label: 'Namn → skylt' },
  { id: 'img2name', label: 'Skylt → namn' },
  { id: 'mixed', label: 'Blandat' },
];

export function StreakStart() {
  const stats = store.stats.value;
  const [category, setCategory] = useState<StreakCategory>(() => (localStorage.getItem('ds:cat') as StreakCategory) || 'vagmarken');
  const [variant, setVariant] = useState<StreakVariant | 'mixed'>(() => (localStorage.getItem('ds:variant') as StreakVariant) || 'name2img');
  const [scope, setScope] = useState<'today' | 'all'>('all');
  const [questions, setQuestions] = useState<Question[] | undefined>(undefined);
  const [playing, setPlaying] = useState<PromptSourceConfig | undefined>(undefined);
  const [over, setOver] = useState<OverInfo | undefined>(undefined);

  useEffect(() => {
    loadAllQuestions().then(setQuestions);
  }, []);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of questions ?? []) m.set(q.category, (m.get(q.category) ?? 0) + 1);
    return m;
  }, [questions]);

  const available = (c: StreakCategory) => c === 'vagmarken' || c === 'blandat' || (counts.get(c) ?? 0) >= 8;

  const pickCategory = (c: StreakCategory) => {
    setCategory(c);
    localStorage.setItem('ds:cat', c);
  };
  const pickVariant = (v: StreakVariant | 'mixed') => {
    setVariant(v);
    localStorage.setItem('ds:variant', v);
  };

  const startGame = () => {
    const recent = stats.recent[category] ?? [];
    setOver(undefined);
    setPlaying({
      category,
      variant: category === 'vagmarken' ? variant : category === 'blandat' ? 'mixed' : 'text',
      signs: quizzableSigns,
      questions: questions ?? [],
      recent,
      textDurationMs: stats.settings.textTimerSec * 1000,
      seed: Date.now() & 0xffffffff,
    });
  };

  const onOver = (s: GameState) => {
    const prevBest = personalBest(store.stats.value, category);
    const prevToday = bestToday(store.stats.value, category);
    const run: GameRun = {
      id: crypto.randomUUID(),
      mode: 'streak',
      category,
      variant: playing?.variant ?? 'name2img',
      startedAt: Date.now() - Math.round((s.endedAt ?? 0) - (s.startedAt ?? 0)),
      endedAt: Date.now(),
      score: s.score,
      bonus: s.bonus,
      correct: s.correct,
      endedBy: s.endedBy ?? 'quit',
      answers: s.answers,
    };
    if (s.answers.length > 0) store.update((st) => recordRun(st, run));
    const cur = s.current;
    setOver({
      run,
      isNewRecord: run.score > prevBest && run.score > 0,
      previousBest: prevBest,
      bestToday: Math.max(prevToday, run.score),
      lastPrompt: cur
        ? {
            title: cur.title,
            correctLabel: cur.options[cur.correctIndex]?.label ?? '',
            explanation: cur.explanation,
            image: cur.kind === 'sign' ? cur.options[cur.correctIndex]?.image ?? cur.image : cur.image,
            endedBy: run.endedBy,
          }
        : undefined,
    });
    setPlaying(undefined);
  };

  const rows = leaderboard(stats, category, scope, 10);

  return (
    <div class="page">
      <header class="page-header">
        <button class="icon-btn" aria-label="Tillbaka" onClick={() => navigate('/')}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </header>
      <h1 class="page-title">Streak</h1>
      <p class="page-subtitle">Hur många frågor klarar du i rad? Svara snabbt för att maximera dina poäng.</p>

      <div class="pill-row" style={{ marginTop: 22 }} role="tablist" aria-label="Kategori">
        {(['vagmarken', ...CATEGORIES.filter((c) => c !== 'vagmarken'), 'blandat'] as StreakCategory[]).map((c) => (
          <button
            key={c}
            class="pill"
            role="tab"
            aria-pressed={category === c}
            disabled={!available(c)}
            style={!available(c) ? { opacity: 0.45 } : undefined}
            onClick={() => pickCategory(c)}
          >
            {CATEGORY_LABEL[c]}
            {!available(c) && ' · snart'}
          </button>
        ))}
      </div>
      {category === 'vagmarken' && (
        <div class="pill-row" aria-label="Variant">
          {VARIANTS.map((v) => (
            <button key={v.id} class="pill pill-small" aria-pressed={variant === v.id} onClick={() => pickVariant(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      )}

      <div class="card" style={{ marginTop: 14 }}>
        <h2 class="section-title" style={{ marginTop: 0 }}>
          Dina poäng
        </h2>
        <div class="stat-row">
          <StatCard value={bestToday(stats, category)} label="Bästa idag" />
          <StatCard value={personalBest(stats, category)} label="Personbästa" />
        </div>
        <button class="btn btn-primary" style={{ marginTop: 18 }} onClick={startGame} disabled={category !== 'vagmarken' && !questions}>
          Spela
        </button>

        <h2 class="section-title">Topplista</h2>
        <div class="pill-row" style={{ justifyContent: 'center' }}>
          <button class="pill pill-small" aria-pressed={scope === 'today'} onClick={() => setScope('today')}>
            Idag
          </button>
          <button class="pill pill-small" aria-pressed={scope === 'all'} onClick={() => setScope('all')}>
            Alla tider
          </button>
        </div>
        <Leaderboard rows={rows} />
      </div>

      {playing && <StreakGame config={playing} onOver={onOver} onClose={() => setPlaying(undefined)} />}
      {over && <StreakOver info={over} stats={store.stats.value} onAgain={startGame} onClose={() => setOver(undefined)} />}
    </div>
  );
}
