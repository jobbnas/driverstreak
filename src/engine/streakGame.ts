import type { AnswerLog, Prompt } from '@/types';
import { pointsFor, streakBonus } from './scoring';

export type Phase = 'idle' | 'countdown' | 'question' | 'feedback' | 'over';

export interface Feedback {
  chosen: number | null;
  correct: boolean;
  points: number;
  bonus: number;
  streak: number;
}

export interface GameState {
  phase: Phase;
  countdown: number;
  score: number;
  bonus: number;
  correct: number;
  current?: Prompt;
  questionStartedAt?: number;
  feedback?: Feedback;
  feedbackDone?: boolean;
  endedBy?: 'wrong' | 'timeout' | 'quit';
  answers: AnswerLog[];
  asked: string[];
  startedAt?: number;
  endedAt?: number;
}

export type GameEvent =
  | { type: 'START'; now: number }
  | { type: 'COUNTDOWN_TICK' }
  | { type: 'PRESENT'; prompt: Prompt; now: number }
  | { type: 'ANSWER'; index: number; now: number }
  | { type: 'TIMEOUT'; now: number }
  | { type: 'FEEDBACK_DONE'; now: number }
  | { type: 'QUIT'; now: number };

export const initialState: GameState = {
  phase: 'idle',
  countdown: 3,
  score: 0,
  bonus: 0,
  correct: 0,
  answers: [],
  asked: [],
};

export function reduce(state: GameState, ev: GameEvent): GameState {
  switch (ev.type) {
    case 'START':
      return { ...initialState, phase: 'countdown', countdown: 3, startedAt: ev.now };

    case 'COUNTDOWN_TICK': {
      if (state.phase !== 'countdown') return state;
      const next = state.countdown - 1;
      // countdown reaches 0 => waiting for PRESENT
      return { ...state, countdown: Math.max(0, next) };
    }

    case 'PRESENT': {
      if (state.phase !== 'countdown' && state.phase !== 'feedback') return state;
      if (state.phase === 'countdown' && state.countdown > 0) return state;
      if (state.phase === 'feedback' && (state.endedBy || !state.feedbackDone)) return state;
      return {
        ...state,
        phase: 'question',
        current: ev.prompt,
        questionStartedAt: ev.now,
        feedback: undefined,
        feedbackDone: false,
        asked: [...state.asked, ev.prompt.qid],
      };
    }

    case 'ANSWER': {
      if (state.phase !== 'question' || !state.current || state.questionStartedAt === undefined) return state;
      const prompt = state.current;
      const elapsed = Math.max(0, ev.now - state.questionStartedAt);
      const left = Math.max(0, prompt.durationMs - elapsed);
      const isCorrect = ev.index === prompt.correctIndex;
      const points = isCorrect ? pointsFor(left, prompt.durationMs) : 0;
      const streak = isCorrect ? state.correct + 1 : state.correct;
      const bonus = isCorrect ? streakBonus(streak) : 0;
      const log: AnswerLog = { qid: prompt.qid, ms: Math.round(elapsed), correct: isCorrect, points };
      return {
        ...state,
        phase: 'feedback',
        score: state.score + points + bonus,
        bonus: state.bonus + bonus,
        correct: streak,
        answers: [...state.answers, log],
        feedback: { chosen: ev.index, correct: isCorrect, points, bonus, streak },
        endedBy: isCorrect ? undefined : 'wrong',
      };
    }

    case 'TIMEOUT': {
      if (state.phase !== 'question' || !state.current) return state;
      const log: AnswerLog = { qid: state.current.qid, ms: state.current.durationMs, correct: false, points: 0 };
      return {
        ...state,
        phase: 'feedback',
        answers: [...state.answers, log],
        feedback: { chosen: null, correct: false, points: 0, bonus: 0, streak: state.correct },
        endedBy: 'timeout',
      };
    }

    case 'FEEDBACK_DONE': {
      if (state.phase !== 'feedback') return state;
      if (state.endedBy) return { ...state, phase: 'over', endedAt: ev.now };
      // stays in feedback until PRESENT arrives with the next prompt
      return { ...state, feedbackDone: true };
    }

    case 'QUIT': {
      if (state.phase === 'over' || state.phase === 'idle') return state;
      return { ...state, phase: 'over', endedBy: 'quit', endedAt: ev.now };
    }
  }
}

/** True when the reducer is ready to receive the next PRESENT. */
export function wantsNextPrompt(state: GameState): boolean {
  if (state.phase === 'countdown') return state.countdown === 0;
  return state.phase === 'feedback' && !state.endedBy && state.feedbackDone === true;
}
