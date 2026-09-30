import { describe, expect, it } from 'vitest';
import { CountdownTimer } from '@/engine/timer';

function clock(start = 0) {
  let t = start;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe('CountdownTimer', () => {
  it('counts down without drift', () => {
    const c = clock(1000);
    const timer = new CountdownTimer(c.now);
    timer.start(9000);
    c.advance(3000);
    expect(timer.remaining()).toBe(6000);
    c.advance(7000);
    expect(timer.remaining()).toBe(0);
    expect(timer.fraction()).toBe(0);
  });
  it('pauses and resumes', () => {
    const c = clock();
    const timer = new CountdownTimer(c.now);
    timer.start(9000);
    c.advance(1000);
    timer.pause();
    c.advance(5000);
    expect(timer.remaining()).toBe(8000);
    timer.resume();
    c.advance(1000);
    expect(timer.remaining()).toBe(7000);
    expect(timer.elapsed()).toBe(2000);
  });
  it('ignores double pause/resume', () => {
    const c = clock();
    const timer = new CountdownTimer(c.now);
    timer.start(1000);
    timer.pause();
    timer.pause();
    c.advance(500);
    timer.resume();
    timer.resume();
    expect(timer.remaining()).toBe(1000);
  });
  it('freezes the remaining time when stopped', () => {
    const c = clock();
    const timer = new CountdownTimer(c.now);
    expect(timer.hasStarted).toBe(false);
    timer.start(1000);
    c.advance(400);
    timer.stop();
    c.advance(5000);
    expect(timer.remaining()).toBe(600);
    expect(timer.fraction()).toBeCloseTo(0.6);
    timer.start(1000);
    expect(timer.remaining()).toBe(1000);
  });
});
