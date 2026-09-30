import { useEffect, useMemo, useState } from 'preact/hooks';
import { BackHeader } from '@/ui/BackHeader';
import { navigate, route } from '@/router';
import { loadAllQuestions, questionById, signByCode, signUrl } from '@/content';
import { EXAM_PASS, EXAM_TOTAL, buildExam, correctPosition, remainingMs, scoreExam, unansweredCount, type ExamSession } from '@/engine/exam';
import { mulberry32, randomSeed } from '@/engine/rng';
import { fmtClock, fmtDate, haptic } from '@/format';
import { store } from '@/store';
import { recordExam } from '@/storage/stats';
import { CATEGORY_LABEL, type ExamResult, type Question, type Category } from '@/types';
import { clearSession, hasStoredSession, loadSession, saveSession } from './examStorage';
import '@/styles/exam.css';
import { ReportButton } from '@/ui/ReportButton';

export function ExamRoutes() {
  const r = route.value;
  const sub = r.parts[1];
  const [questions, setQuestions] = useState<Question[] | undefined>();
  useEffect(() => {
    loadAllQuestions().then(setQuestions);
  }, []);
  if (!questions) return <div class="page"><BackHeader /><p class="empty">Laddar frågor…</p></div>;
  if (sub === 'run') return <ExamRun questions={questions} />;
  if (sub === 'result' && r.parts[2]) return <ExamResultScreen id={r.parts[2]} />;
  if (sub === 'review' && r.parts[2]) return <ExamReview id={r.parts[2]} onlyWrong={r.query.get('fel') === '1'} />;
  return <ExamIntro questions={questions} />;
}

function ExamIntro(props: { questions: Question[] }) {
  const stats = store.stats.value;
  const resumable = hasStoredSession();
  const last = stats.exams[stats.exams.length - 1];
  const enough = props.questions.length >= EXAM_TOTAL;
  return (
    <div class="page">
      <BackHeader />
      <h1 class="page-title">Övningsprov</h1>
      <p class="page-subtitle">Simulerar Trafikverkets kunskapsprov för behörighet B.</p>
      <div class="card" style={{ marginTop: 22 }}>
        <ul class="rules">
          <li><b>{EXAM_TOTAL} frågor</b> – ett rätt svar per fråga.</li>
          <li><b>50 minuter</b> – klockan går även om du lämnar appen.</li>
          <li><b>{EXAM_PASS} rätt</b> krävs för godkänt.</li>
          <li>Du kan flagga frågor och hoppa fram och tillbaka innan du lämnar in.</li>
          <li>Fördelningen mellan ämnesområdena är en uppskattning av det riktiga provet.</li>
        </ul>
        {resumable && (
          <button class="btn btn-primary" style={{ marginTop: 18 }} onClick={() => navigate('/exam/run')}>
            Fortsätt pågående prov
          </button>
        )}
        <button
          class={`btn ${resumable ? 'btn-surface' : 'btn-primary'}`}
          style={{ marginTop: 12, width: '100%' }}
          disabled={!enough}
          onClick={() => {
            clearSession();
            navigate('/exam/run');
          }}
        >
          {resumable ? 'Starta nytt prov' : 'Starta provet'}
        </button>
        {!enough && <p class="muted center" style={{ marginTop: 10, fontSize: 13 }}>Frågebanken är inte tillräckligt stor än ({props.questions.length}/{EXAM_TOTAL}).</p>}
      </div>
      {stats.exams.length > 0 && (
        <>
          <h2 class="section-title">Tidigare prov</h2>
          <div class="leaderboard">
            {[...stats.exams].reverse().slice(0, 10).map((e) => (
              <button key={e.id} class="leaderboard-row" style={{ width: '100%', textAlign: 'left' }} onClick={() => navigate(`/exam/result/${e.id}`)}>
                <span class="who">
                  {e.passed ? '✅ Godkänd' : '❌ Underkänd'}
                  <span class="meta">{fmtDate(e.endedAt)}</span>
                </span>
                <span class="score">{e.correct}/{e.total}</span>
              </button>
            ))}
          </div>
          {last && <p class="muted center" style={{ marginTop: 10, fontSize: 13 }}>Senaste: {last.correct} rätt.</p>}
        </>
      )}
    </div>
  );
}

function ExamRun(props: { questions: Question[] }) {
  const [session, setSession] = useState<ExamSession>(() => loadSession(props.questions) ?? buildExam(props.questions, mulberry32(randomSeed())));
  const [left, setLeft] = useState(() => remainingMs(session));
  const [overview, setOverview] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const eq = session.questions[session.cursor];

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    const t = setInterval(() => {
      const ms = remainingMs(session);
      setLeft(ms);
      if (ms <= 0) submit();
    }, 500);
    return () => clearInterval(t);
  }, [session.startedAt]);

  const update = (fn: (s: ExamSession) => ExamSession) => setSession((s) => fn({ ...s, answers: [...s.answers], flagged: [...s.flagged] }));

  const submit = () => {
    const result = scoreExam(session);
    store.update((st) => recordExam(st, result));
    store.flush();
    clearSession();
    navigate(`/exam/result/${result.id}`, true);
  };

  if (!eq) return null;
  const answered = session.answers.filter((a) => a !== null).length;
  const signRef = eq.q.signRefs?.[0];
  const sign = signRef ? signByCode.get(signRef) : undefined;

  return (
    <div class="page exam">
      <BackHeader onBack={() => navigate('/exam')} title={`Fråga ${session.cursor + 1} av ${session.questions.length}`}>
        <span class={`exam-clock${left < 5 * 60000 ? ' warn' : ''}`}>{fmtClock(left)}</span>
      </BackHeader>
      <div class="exam-progress"><div style={{ width: `${(answered / session.questions.length) * 100}%` }} /></div>
      <div class="exam-q">
        <div class="exam-q-head">
          <span class="muted" style={{ fontSize: 13 }}>{CATEGORY_LABEL[eq.q.category]}</span>
          <button class={`flag${session.flagged[session.cursor] ? ' on' : ''}`} onClick={() => update((s) => { s.flagged[s.cursor] = !s.flagged[s.cursor]; return s; })} aria-pressed={session.flagged[session.cursor]}>
            ⚑ {session.flagged[session.cursor] ? 'Flaggad' : 'Flagga'}
          </button>
        </div>
        {sign && <img class="exam-sign" src={signUrl(sign.files[0] as string)} alt={sign.name} />}
        <h2 class="exam-question">{eq.q.question}</h2>
        <div class="options">
          {eq.order.map((orig, pos) => (
            <button
              key={pos}
              class={`option${session.answers[session.cursor] === pos ? ' selected' : ''}`}
              onClick={() => {
                haptic(8);
                update((s) => { s.answers[s.cursor] = pos; return s; });
              }}
            >
              <span class="option-letter">{'ABCD'[pos]}</span>
              <span>{eq.q.options[orig]}</span>
            </button>
          ))}
        </div>
      </div>
      <div class="exam-nav">
        <button class="btn btn-surface" disabled={session.cursor === 0} onClick={() => update((s) => ({ ...s, cursor: s.cursor - 1 }))}>Föregående</button>
        <button class="btn btn-surface" onClick={() => setOverview(true)}>Översikt</button>
        {session.cursor < session.questions.length - 1 ? (
          <button class="btn btn-primary" style={{ width: 'auto' }} onClick={() => update((s) => ({ ...s, cursor: s.cursor + 1 }))}>Nästa</button>
        ) : (
          <button class="btn btn-primary" style={{ width: 'auto' }} onClick={() => setConfirm(true)}>Lämna in</button>
        )}
      </div>

      {overview && (
        <div class="modal" onClick={() => setOverview(false)}>
          <div class="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Översikt</h3>
            <p class="muted" style={{ fontSize: 13 }}>{answered} besvarade · {unansweredCount(session)} kvar · {session.flagged.filter(Boolean).length} flaggade</p>
            <div class="grid-nums">
              {session.questions.map((_, i) => (
                <button
                  key={i}
                  class={`num${session.answers[i] !== null ? ' done' : ''}${session.flagged[i] ? ' flag' : ''}${i === session.cursor ? ' cur' : ''}`}
                  onClick={() => { update((s) => ({ ...s, cursor: i })); setOverview(false); }}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button class="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { setOverview(false); setConfirm(true); }}>Lämna in provet</button>
            <button class="btn btn-ghost" style={{ width: '100%' }} onClick={() => setOverview(false)}>Stäng</button>
          </div>
        </div>
      )}
      {confirm && (
        <div class="modal" onClick={() => setConfirm(false)}>
          <div class="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>Lämna in?</h3>
            <p style={{ marginTop: 8 }}>
              {unansweredCount(session) > 0 ? `Du har ${unansweredCount(session)} obesvarade frågor. Obesvarade räknas som fel.` : 'Alla frågor är besvarade.'}
            </p>
            <button class="btn btn-primary" style={{ marginTop: 16 }} onClick={submit}>Lämna in</button>
            <button class="btn btn-ghost" style={{ width: '100%' }} onClick={() => setConfirm(false)}>Fortsätt provet</button>
          </div>
        </div>
      )}
    </div>
  );
}

function useExam(id: string): ExamResult | undefined {
  return useMemo(() => store.stats.value.exams.find((e) => e.id === id), [id, store.stats.value.exams.length]);
}

function ExamResultScreen(props: { id: string }) {
  const exam = useExam(props.id);
  if (!exam) return <div class="page"><BackHeader to="/exam" /><p class="empty">Provet hittades inte.</p></div>;
  const pct = Math.round((exam.correct / exam.total) * 100);
  const wrong = exam.answers.filter((a) => !a.correct).length;
  return (
    <div class="page">
      <BackHeader to="/exam" />
      <h1 class="page-title" style={{ color: exam.passed ? 'var(--green)' : 'var(--red)' }}>{exam.passed ? 'Godkänd!' : 'Underkänd'}</h1>
      <p class="page-subtitle">{exam.correct} av {exam.total} rätt · gräns {EXAM_PASS}</p>
      <div class="ring-wrap">
        <div class="ring" style={{ '--pct': String(pct), '--col': exam.passed ? 'var(--green)' : 'var(--red)' } as Record<string, string>}>
          <span>{pct}%</span>
        </div>
      </div>
      <div class="card">
        {(Object.entries(exam.perArea) as [Category, { correct: number; total: number }][]).map(([cat, v]) => (
          <div class="area-row" key={cat}>
            <div class="area-head"><span>{CATEGORY_LABEL[cat]}</span><span class="muted">{v.correct}/{v.total}</span></div>
            <div class="area-bar"><div style={{ width: `${(v.correct / Math.max(1, v.total)) * 100}%` }} /></div>
          </div>
        ))}
      </div>
      <div class="stack" style={{ marginTop: 16 }}>
        {wrong > 0 && <button class="btn btn-primary" onClick={() => navigate(`/exam/review/${exam.id}?fel=1`)}>Gå igenom {wrong} fel</button>}
        <button class="btn btn-surface" onClick={() => navigate(`/exam/review/${exam.id}`)}>Visa alla frågor</button>
        <button class="btn btn-ghost" onClick={() => navigate('/exam')}>Till övningsprov</button>
      </div>
    </div>
  );
}

function ExamReview(props: { id: string; onlyWrong: boolean }) {
  const exam = useExam(props.id);
  if (!exam) return <div class="page"><BackHeader to="/exam" /><p class="empty">Provet hittades inte.</p></div>;
  const rows = exam.answers.map((a, i) => ({ a, i, q: questionById(a.qid) })).filter((r) => r.q && (!props.onlyWrong || !r.a.correct));
  return (
    <div class="page">
      <BackHeader to={`/exam/result/${exam.id}`} title={props.onlyWrong ? 'Dina fel' : 'Alla frågor'} />
      <div class="stack">
        {rows.map(({ a, i, q }) => (
          <ReviewCard key={a.qid} index={i} q={q as Question} chosenOriginal={a.chosen === null ? null : chosenOriginal(exam, a, q as Question)} correct={a.correct} />
        ))}
        {rows.length === 0 && <p class="empty">Inga fel – snyggt!</p>}
      </div>
    </div>
  );
}

// We do not store the shuffled order in the result, so map chosen position back via the correct flag.
function chosenOriginal(_exam: ExamResult, a: ExamResult['answers'][number], q: Question): number | null {
  if (a.chosen === null) return null;
  if (a.correct) return q.correct;
  return -1; // unknown wrong option; UI shows "fel svar"
}

export function ReviewCard(props: { index?: number; q: Question; chosenOriginal: number | null; correct: boolean; chosenLabel?: string }) {
  const { q } = props;
  const sign = q.signRefs?.[0] ? signByCode.get(q.signRefs[0]) : undefined;
  return (
    <div class="card review-card">
      <div class="exam-q-head">
        <span class="muted" style={{ fontSize: 13 }}>{props.index !== undefined ? `Fråga ${props.index + 1} · ` : ''}{CATEGORY_LABEL[q.category]}</span>
        <span style={{ color: props.correct ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>{props.correct ? 'Rätt' : props.chosenOriginal === null ? 'Obesvarad' : 'Fel'}</span>
      </div>
      {sign && <img class="exam-sign" src={signUrl(sign.files[0] as string)} alt={sign.name} />}
      <p style={{ fontWeight: 700, marginTop: 8 }}>{q.question}</p>
      <div class="options small">
        {q.options.map((o, i) => (
          <div key={i} class={`option static${i === q.correct ? ' right' : ''}${props.chosenLabel === o && i !== q.correct ? ' wrong' : ''}`}>
            <span class="option-letter">{'ABCD'[i]}</span>
            <span>{o}</span>
          </div>
        ))}
      </div>
      <p class="expl">{q.explanation}</p>
      {q.legalRef && <p class="muted" style={{ fontSize: 12, marginTop: 6 }}>{q.legalRef}</p>}
      <ReportButton qid={q.id} />
    </div>
  );
}

export { correctPosition };
