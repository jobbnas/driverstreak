import { useEffect, useMemo, useRef } from 'preact/hooks';
import { signal, useSignal } from '@preact/signals';
import { CountdownTimer } from '@/engine/timer';
import { initialState, reduce, wantsNextPrompt, type GameEvent, type GameState } from '@/engine/streakGame';
import { FEEDBACK_MS } from '@/engine/scoring';
import type { PromptSource } from '@/engine/prompts';
import type { Prompt } from '@/types';
import { signUrl } from '@/content';
import { haptic } from '@/format';

const COUNTDOWN_STEP_MS = 800;

function preload(prompt: Prompt): void {
  const files = [prompt.image, ...prompt.options.map((o) => o.image)].filter(Boolean) as string[];
  for (const f of files) {
    const img = new Image();
    img.src = signUrl(f);
  }
}

export function useStreakGame(source: PromptSource, onOver: (state: GameState) => void) {
  const state = useSignal<GameState>(initialState);
  const timer = useMemo(() => new CountdownTimer(), []);
  const nextPrompt = useRef<Prompt | undefined>(undefined);
  const timeouts = useRef<ReturnType<typeof setTimeout>[]>([]);
  const finished = useRef(false);
  const exhausted = useSignal(false);

  const later = (fn: () => void, ms: number) => {
    const t = setTimeout(fn, ms);
    timeouts.current.push(t);
  };

  const dispatch = (ev: GameEvent) => {
    const before = state.value;
    const after = reduce(before, ev);
    if (after === before) return;
    state.value = after;

    if (after.phase === 'question' && before.phase !== 'question') {
      timer.start(after.current!.durationMs);
      // prepare the following prompt right away so its images are cached
      nextPrompt.current = source.next();
      if (nextPrompt.current) preload(nextPrompt.current);
    }

    if (after.phase === 'feedback' && before.phase === 'question') {
      timer.stop();
      haptic(after.feedback?.correct ? 12 : [30, 40, 30]);
      later(() => dispatch({ type: 'FEEDBACK_DONE', now: performance.now() }), after.endedBy ? FEEDBACK_MS + 300 : FEEDBACK_MS);
    }

    if (wantsNextPrompt(after)) {
      const p = nextPrompt.current;
      nextPrompt.current = undefined;
      if (p) dispatch({ type: 'PRESENT', prompt: p, now: performance.now() });
      else if (after.phase === 'feedback' || after.phase === 'countdown') {
        exhausted.value = true;
        dispatch({ type: 'QUIT', now: performance.now() });
      }
    }

    if (after.phase === 'over' && !finished.current) {
      finished.current = true;
      timer.stop();
      onOver(after);
    }
  };

  const start = () => {
    finished.current = false;
    exhausted.value = false;
    nextPrompt.current = source.next();
    if (nextPrompt.current) preload(nextPrompt.current);
    dispatch({ type: 'START', now: performance.now() });
    for (let i = 1; i <= 3; i++) later(() => dispatch({ type: 'COUNTDOWN_TICK' }), COUNTDOWN_STEP_MS * i);
  };

  const answer = (index: number) => dispatch({ type: 'ANSWER', index, now: performance.now() });
  const quit = () => dispatch({ type: 'QUIT', now: performance.now() });

  // Timeout detection runs on the rAF loop of the progress bar.
  const tick = (fraction: number) => {
    if (state.value.phase === 'question' && timer.isRunning && fraction <= 0) {
      dispatch({ type: 'TIMEOUT', now: performance.now() });
    }
  };

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'hidden') timer.pause();
      else timer.resume();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      for (const t of timeouts.current) clearTimeout(t);
      timer.stop();
    };
  }, [timer]);

  return { state, timer, start, answer, quit, tick, exhausted };
}

export const lastRunId = signal<string | undefined>(undefined);
