import { useEffect, useMemo, useState } from 'preact/hooks';
import { BackHeader } from '@/ui/BackHeader';
import { navigate, route } from '@/router';
import { loadAllQuestions, signByCode, signUrl } from '@/content';
import subtopics from '../../../content/subtopics.json';
import { CATEGORIES, CATEGORY_LABEL, type Category, type Question } from '@/types';
import { store } from '@/store';
import { recordAnswers, touchDaily, wrongBank } from '@/storage/stats';
import { pickPractice } from '@/engine/practice';
import { mulberry32, randomSeed, shuffle } from '@/engine/rng';
import { haptic } from '@/format';

type Sub = Record<string, Record<string, { label: string; target: number }>>;
const SUBS = subtopics as Sub;

export function PracticeRoutes() {
  const [questions, setQuestions] = useState<Question[] | undefined>();
  useEffect(() => {
    loadAllQuestions().then(setQuestions);
  }, []);
  if (!questions) return <div class="page"><BackHeader /><p class="empty">Laddar frågor…</p></div>;
  return route.value.parts[1] === 'run' ? <PracticeRun questions={questions} /> : <PracticePicker questions={questions} />;
}

function PracticePicker(props: { questions: Question[] }) {
  const stats = store.stats.value;
  const [category, setCategory] = useState<Category | 'fel' | 'alla'>('alla');
  const [sub, setSub] = useState<string | undefined>();
  const [length, setLength] = useState<10 | 20 | 0>(10);
  const wrong = wrongBank(stats);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const q of props.questions) m.set(`${q.category}/${q.subtopic}`, (m.get(`${q.category}/${q.subtopic}`) ?? 0) + 1);
    return m;
  }, [props.questions]);
  const start = () => {
    const params = new URLSearchParams();
    params.set('cat', category);
    if (sub) params.set('sub', sub);
    params.set('n', String(length));
    navigate(`/practice/run?${params}`);
  };
  return (
    <div class="page">
      <BackHeader />
      <h1 class="page-title">Övning</h1>
      <p class="page-subtitle">Utan tidspress. Förklaring efter varje svar.</p>
      <div class="pill-row" style={{ marginTop: 20 }}>
        <button class="pill" aria-pressed={category === 'alla'} onClick={() => { setCategory('alla'); setSub(undefined); }}>Alla ämnen</button>
        <button class="pill" aria-pressed={category === 'fel'} disabled={wrong.length === 0} style={wrong.length === 0 ? { opacity: 0.45 } : undefined} onClick={() => { setCategory('fel'); setSub(undefined); }}>
          Mina fel ({wrong.length})
        </button>
        {CATEGORIES.map((c) => (
          <button key={c} class="pill" aria-pressed={category === c} onClick={() => { setCategory(c); setSub(undefined); }}>{CATEGORY_LABEL[c]}</button>
        ))}
      </div>
      {category !== 'alla' && category !== 'fel' && (
        <div class="subtopic-grid" style={{ marginTop: 6 }}>
          <button class="pill pill-small" aria-pressed={!sub} onClick={() => setSub(undefined)}>Hela ämnet</button>
          {Object.entries(SUBS[category] ?? {}).map(([key, meta]) => {
            const n = counts.get(`${category}/${key}`) ?? 0;
            return (
              <button key={key} class="pill pill-small" aria-pressed={sub === key} disabled={n === 0} style={n === 0 ? { opacity: 0.4 } : undefined} onClick={() => setSub(key)}>
                {meta.label} <span class="muted">{n}</span>
              </button>
            );
          })}
        </div>
      )}
      <div class="card" style={{ marginTop: 18 }}>
        <p class="muted" style={{ fontSize: 13, marginBottom: 10 }}>Antal frågor</p>
        <div class="pill-row">
          {([10, 20, 0] as const).map((n) => (
            <button key={n} class="pill" aria-pressed={length === n} onClick={() => setLength(n)}>{n === 0 ? 'Oändligt' : n}</button>
          ))}
        </div>
        <button class="btn btn-primary" style={{ marginTop: 14 }} onClick={start}>Börja öva</button>
      </div>
    </div>
  );
}

function PracticeRun(props: { questions: Question[] }) {
  const q = route.value.query;
  const cat = q.get('cat') ?? 'alla';
  const sub = q.get('sub') ?? undefined;
  const limit = Number(q.get('n') ?? 10);
  const rng = useMemo(() => mulberry32(randomSeed()), []);
  const pool = useMemo(() => {
    if (cat === 'fel') {
      const ids = new Set(wrongBank(store.stats.value));
      return props.questions.filter((x) => ids.has(x.id));
    }
    return props.questions.filter((x) => (cat === 'alla' || x.category === cat) && (!sub || x.subtopic === sub));
  }, [cat, sub]);
  const [asked, setAsked] = useState<string[]>([]);
  const [current, setCurrent] = useState<{ q: Question; order: number[] } | undefined>();
  const [chosen, setChosen] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, total: 0 });
  const [done, setDone] = useState(false);

  const next = () => {
    if (limit > 0 && asked.length >= limit) {
      setDone(true);
      return;
    }
    const nq = pickPractice(pool, asked, store.stats.value.questions, rng);
    if (!nq) {
      setDone(true);
      return;
    }
    setCurrent({ q: nq, order: shuffle([0, 1, 2, 3], rng) });
    setChosen(null);
    setAsked((a) => [...a, nq.id]);
  };

  useEffect(() => {
    next();
  }, []);

  useEffect(() => {
    if (done && score.total > 0) store.update((s) => touchDaily(s));
  }, [done]);

  const answer = (pos: number) => {
    if (!current || chosen !== null) return;
    setChosen(pos);
    const ok = current.order[pos] === current.q.correct;
    haptic(ok ? 10 : [30, 40, 30]);
    setScore((s) => ({ right: s.right + (ok ? 1 : 0), total: s.total + 1 }));
    store.update((s) => recordAnswers(s, [{ qid: current.q.id, correct: ok, at: Date.now() }]));
  };

  if (done || (!current && pool.length === 0)) {
    return (
      <div class="page">
        <BackHeader to="/practice" />
        <h1 class="page-title">{pool.length === 0 ? 'Inga frågor' : 'Klart!'}</h1>
        <p class="page-subtitle">{pool.length === 0 ? 'Det finns inga frågor i det här urvalet än.' : `${score.right} av ${score.total} rätt.`}</p>
        <div class="stack" style={{ marginTop: 24 }}>
          {pool.length > 0 && <button class="btn btn-primary" onClick={() => { setAsked([]); setScore({ right: 0, total: 0 }); setDone(false); setTimeout(next, 0); }}>Kör igen</button>}
          <button class="btn btn-surface" onClick={() => navigate('/practice')}>Välj annat</button>
        </div>
      </div>
    );
  }
  if (!current) return null;
  const sign = current.q.signRefs?.[0] ? signByCode.get(current.q.signRefs[0]) : undefined;
  const ok = chosen !== null && current.order[chosen] === current.q.correct;
  return (
    <div class="page exam">
      <BackHeader to="/practice" title={limit > 0 ? `${asked.length} / ${limit}` : `${asked.length}`}>
        <span class="muted" style={{ fontSize: 14 }}>{score.right} rätt</span>
      </BackHeader>
      <div class="exam-q">
        <span class="muted" style={{ fontSize: 13 }}>{CATEGORY_LABEL[current.q.category]} · {SUBS[current.q.category]?.[current.q.subtopic]?.label ?? current.q.subtopic}</span>
        {sign && <img class="exam-sign" src={signUrl(sign.files[0] as string)} alt={sign.name} />}
        <h2 class="exam-question">{current.q.question}</h2>
        <div class="options">
          {current.order.map((orig, pos) => {
            const cls = ['option'];
            if (chosen !== null) {
              cls.push('static');
              if (orig === current.q.correct) cls.push('right');
              else if (pos === chosen) cls.push('wrong');
            }
            return (
              <button key={pos} class={cls.join(' ')} onClick={() => answer(pos)} disabled={chosen !== null}>
                <span class="option-letter">{'ABCD'[pos]}</span>
                <span>{current.q.options[orig]}</span>
              </button>
            );
          })}
        </div>
        {chosen !== null && (
          <div class="practice-expl">
            <p class="verdict" style={{ color: ok ? 'var(--green)' : 'var(--red)' }}>{ok ? 'Rätt!' : 'Fel'}</p>
            <p style={{ marginTop: 6, lineHeight: 1.45 }}>{current.q.explanation}</p>
            {current.q.legalRef && <p class="muted" style={{ fontSize: 12, marginTop: 6 }}>{current.q.legalRef}</p>}
            <button class="btn btn-primary" style={{ marginTop: 14 }} onClick={next}>Nästa</button>
          </div>
        )}
      </div>
    </div>
  );
}
