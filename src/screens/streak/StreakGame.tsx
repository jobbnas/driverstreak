import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Sheet } from '@/ui/Sheet';
import { Score } from '@/ui/Score';
import { ProgressBar } from '@/ui/ProgressBar';
import { Tiles } from '@/ui/Tiles';
import { Countdown } from '@/ui/Countdown';
import { signUrl } from '@/content';
import { PromptSource, type PromptSourceConfig } from '@/engine/prompts';
import { bonusLabel } from '@/engine/scoring';
import type { GameState } from '@/engine/streakGame';
import { fmt } from '@/format';
import { useStreakGame } from './useStreakGame';

export function StreakGame(props: { config: PromptSourceConfig; onOver: (s: GameState) => void; onClose: () => void }) {
  const source = useMemo(() => new PromptSource(props.config), [props.config]);
  const game = useStreakGame(source, props.onOver);
  const s = game.state.value;
  const startedRef = useRef(false);

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      game.start();
    }
  }, []);

  const close = () => {
    game.quit();
    props.onClose();
  };

  const isText = s.current?.kind === 'text';
  const longTitle = (s.current?.title.length ?? 0) > 60;

  return (
    <Sheet onClose={close} label="Streak">
      {s.phase === 'countdown' && <Countdown n={s.countdown} />}
      {(s.phase === 'question' || s.phase === 'feedback' || s.phase === 'over') && s.current && (
        <div class={`game${isText ? ' game-text' : ''}`}>
          <div style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
            <Score value={s.score} />
            <Delta feedback={s.feedback} />
          </div>
          <ProgressBar timer={game.timer} active={s.phase === 'question'} tick={game.tick} />
          <div class="round" key={s.current.qid}>
            <h1 class={`round-title${longTitle ? ' long' : ''}`}>{s.current.title}</h1>
            {s.current.image && (
              <div class="round-image">
                <img src={signUrl(s.current.image)} alt="" decoding="async" />
              </div>
            )}
            <Tiles prompt={s.current} feedback={s.feedback} onAnswer={game.answer} />
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Delta(props: { feedback?: GameState['feedback'] }) {
  const [items, setItems] = useState<{ id: number; text: string; bonus?: string }[]>([]);
  const counter = useRef(0);
  useEffect(() => {
    const fb = props.feedback;
    if (!fb || !fb.correct) return;
    const id = ++counter.current;
    setItems((xs) => [...xs, { id, text: `+${fmt(fb.points)}`, bonus: fb.bonus ? `${bonusLabel(fb.streak)} +${fmt(fb.bonus)}` : undefined }]);
    const t = setTimeout(() => setItems((xs) => xs.filter((x) => x.id !== id)), 1500);
    return () => clearTimeout(t);
  }, [props.feedback]);
  return (
    <>
      {items.map((it) => (
        <span key={it.id}>
          <span class="delta">{it.text}</span>
          {it.bonus && <span class="bonus-burst">{it.bonus}</span>}
        </span>
      ))}
    </>
  );
}
