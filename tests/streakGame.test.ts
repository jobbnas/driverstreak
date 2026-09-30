import { describe, expect, it } from 'vitest';
import { initialState, reduce, wantsNextPrompt, type GameState } from '@/engine/streakGame';
import type { Prompt } from '@/types';

function prompt(n: number, correctIndex = 0): Prompt {
  return {
    qid: `q${n}`,
    kind: 'sign',
    variant: 'name2img',
    title: `Sign ${n}`,
    options: [{ label: 'a' }, { label: 'b' }, { label: 'c' }, { label: 'd' }],
    correctIndex,
    durationMs: 9000,
  };
}

function startAndCountdown(): GameState {
  let s = reduce(initialState, { type: 'START', now: 0 });
  expect(s.phase).toBe('countdown');
  s = reduce(s, { type: 'COUNTDOWN_TICK' });
  s = reduce(s, { type: 'COUNTDOWN_TICK' });
  expect(wantsNextPrompt(s)).toBe(false);
  s = reduce(s, { type: 'COUNTDOWN_TICK' });
  expect(wantsNextPrompt(s)).toBe(true);
  return s;
}

describe('streak reducer', () => {
  it('runs a full game with bonus at 5 and ends on a wrong answer', () => {
    let s = startAndCountdown();
    let now = 3000;
    for (let i = 1; i <= 5; i++) {
      s = reduce(s, { type: 'PRESENT', prompt: prompt(i), now });
      expect(s.phase).toBe('question');
      now += 900; // 10% elapsed => 1080 points
      s = reduce(s, { type: 'ANSWER', index: 0, now });
      expect(s.phase).toBe('feedback');
      expect(s.feedback?.correct).toBe(true);
      expect(s.feedback?.points).toBe(1080);
      expect(wantsNextPrompt(s)).toBe(false); // not until feedback is done
      const during = s;
      expect(reduce(s, { type: 'PRESENT', prompt: prompt(99), now })).toBe(during);
      s = reduce(s, { type: 'FEEDBACK_DONE', now });
      expect(s.phase).toBe('feedback');
      expect(wantsNextPrompt(s)).toBe(true);
    }
    expect(s.correct).toBe(5);
    expect(s.bonus).toBe(500);
    expect(s.score).toBe(5 * 1080 + 500);
    expect(s.feedback?.bonus).toBe(500);

    s = reduce(s, { type: 'PRESENT', prompt: prompt(6, 2), now });
    s = reduce(s, { type: 'ANSWER', index: 1, now: now + 100 });
    expect(s.phase).toBe('feedback');
    expect(s.feedback?.correct).toBe(false);
    expect(s.endedBy).toBe('wrong');
    expect(wantsNextPrompt(s)).toBe(false);
    s = reduce(s, { type: 'FEEDBACK_DONE', now: now + 1300 });
    expect(s.phase).toBe('over');
    expect(s.correct).toBe(5);
    expect(s.answers).toHaveLength(6);
    expect(s.asked).toEqual(['q1', 'q2', 'q3', 'q4', 'q5', 'q6']);
  });

  it('ends on timeout', () => {
    let s = startAndCountdown();
    s = reduce(s, { type: 'PRESENT', prompt: prompt(1), now: 0 });
    s = reduce(s, { type: 'TIMEOUT', now: 9000 });
    expect(s.phase).toBe('feedback');
    expect(s.endedBy).toBe('timeout');
    expect(s.feedback?.chosen).toBeNull();
    s = reduce(s, { type: 'FEEDBACK_DONE', now: 10200 });
    expect(s.phase).toBe('over');
    expect(s.score).toBe(0);
  });

  it('ignores answers during feedback and countdown', () => {
    let s = reduce(initialState, { type: 'START', now: 0 });
    const before = s;
    s = reduce(s, { type: 'ANSWER', index: 0, now: 10 });
    expect(s).toBe(before);
    s = startAndCountdown();
    s = reduce(s, { type: 'PRESENT', prompt: prompt(1), now: 0 });
    s = reduce(s, { type: 'ANSWER', index: 0, now: 100 });
    const fb = s;
    s = reduce(s, { type: 'ANSWER', index: 1, now: 200 });
    expect(s).toBe(fb);
  });

  it('gives 0 points for a late answer but still continues', () => {
    let s = startAndCountdown();
    s = reduce(s, { type: 'PRESENT', prompt: prompt(1), now: 0 });
    s = reduce(s, { type: 'ANSWER', index: 0, now: 8990 });
    expect(s.feedback?.points).toBe(1);
    expect(s.endedBy).toBeUndefined();
  });

  it('quits from any active phase', () => {
    let s = startAndCountdown();
    s = reduce(s, { type: 'PRESENT', prompt: prompt(1), now: 0 });
    s = reduce(s, { type: 'QUIT', now: 500 });
    expect(s.phase).toBe('over');
    expect(s.endedBy).toBe('quit');
  });

  it('does not present before the countdown is finished', () => {
    let s = reduce(initialState, { type: 'START', now: 0 });
    s = reduce(s, { type: 'PRESENT', prompt: prompt(1), now: 0 });
    expect(s.phase).toBe('countdown');
  });
});
