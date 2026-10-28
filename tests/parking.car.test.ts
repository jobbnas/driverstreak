import { describe, expect, it } from 'vitest';
import { DEFAULT_CAR, integratePose, minTurnRadius, stepSpeed, stepSteer, carCorners, wheelPositions } from '@/engine/parking/car';
import { createSim, step, advance, FIXED_DT } from '@/engine/parking/sim';
import { SCENARIOS } from '@/engine/parking/scenarios';
import type { Pose } from '@/engine/parking/types';

const spec = DEFAULT_CAR;

describe('bicycle model', () => {
  it('drives straight', () => {
    let p: Pose = { x: 0, y: 0, heading: 0 };
    for (let i = 0; i < 60; i++) p = integratePose(p, 1, 0, 1 / 60, spec);
    expect(p.x).toBeCloseTo(1, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });
  it('full lock circle returns to start', () => {
    const R = minTurnRadius(spec);
    expect(R).toBeCloseTo(3.83, 1);
    const circumference = 2 * Math.PI * R;
    let p: Pose = { x: 1, y: 2, heading: 0.3 };
    const n = 6000;
    const dt = circumference / n;
    for (let i = 0; i < n; i++) p = integratePose(p, 1, spec.maxSteerRad, dt, spec);
    expect(p.x).toBeCloseTo(1, 6);
    expect(p.y).toBeCloseTo(2, 6);
    expect(Math.abs(p.heading - 0.3)).toBeLessThan(1e-6);
  });
  it('quarter turn lands at radius R and reverse is symmetric', () => {
    const R = minTurnRadius(spec);
    let p: Pose = { x: 0, y: 0, heading: 0 };
    const quarter = (Math.PI / 2) * R;
    for (let i = 0; i < 1000; i++) p = integratePose(p, 1, spec.maxSteerRad, quarter / 1000, spec);
    expect(p.x).toBeCloseTo(R, 6);
    expect(p.y).toBeCloseTo(R, 6);
    expect(p.heading).toBeCloseTo(Math.PI / 2, 6);
    for (let i = 0; i < 1000; i++) p = integratePose(p, -1, spec.maxSteerRad, quarter / 1000, spec);
    expect(p.x).toBeCloseTo(0, 6);
    expect(p.y).toBeCloseTo(0, 6);
    expect(Math.abs(p.heading)).toBeLessThan(1e-6);
  });
  it('kerb-to-kerb turning circle is about 10.7 m', () => {
    const R = minTurnRadius(spec);
    const outerFront = Math.hypot(R + spec.track / 2, spec.wheelbase);
    expect(outerFront * 2).toBeGreaterThan(10.3);
    expect(outerFront * 2).toBeLessThan(11.0);
  });
  it('steering is rate limited', () => {
    let s = 0;
    let steps = 0;
    while (s < spec.maxSteerRad - 1e-9) {
      s = stepSteer(s, 1, 1 / 60, spec);
      steps++;
    }
    const expected = spec.maxSteerRad / spec.steerRateRadPerS;
    expect(steps / 60).toBeCloseTo(expected, 1);
  });
  it('speed is capped, creeps, and brakes', () => {
    let v = 0;
    for (let i = 0; i < 600; i++) v = stepSpeed(v, 1, true, false, 8 / 3.6, 1 / 60, spec);
    expect(v).toBeCloseTo(8 / 3.6, 6);
    for (let i = 0; i < 600; i++) v = stepSpeed(v, 1, false, false, 8 / 3.6, 1 / 60, spec);
    expect(v).toBeCloseTo(spec.creepSpeed, 6);
    for (let i = 0; i < 120; i++) v = stepSpeed(v, 1, false, true, 8 / 3.6, 1 / 60, spec);
    expect(v).toBe(0);
    for (let i = 0; i < 600; i++) v = stepSpeed(v, -1, false, false, 8 / 3.6, 1 / 60, spec);
    expect(v).toBeCloseTo(-spec.creepSpeed, 6);
  });
  it('corners and wheels are placed around the rear axle', () => {
    const c = carCorners({ x: 0, y: 0, heading: 0 }, spec);
    expect(c.fr.x).toBeCloseTo(spec.wheelbase + spec.frontOverhang, 6);
    expect(c.fr.y).toBeCloseTo(-spec.width / 2, 6);
    expect(c.rl.x).toBeCloseTo(-(spec.length - spec.wheelbase - spec.frontOverhang), 6);
    const w = wheelPositions({ x: 0, y: 0, heading: 0 }, spec);
    expect(w.rr.y).toBeCloseTo(-spec.track / 2, 6);
    expect(w.fl.x).toBeCloseTo(spec.wheelbase, 6);
  });
});

describe('sim stepping', () => {
  const sandbox = SCENARIOS[0]!;
  it('refuses gear changes while moving and counts moves', () => {
    const sim = createSim(sandbox);
    let events = step(sim, { steer: 0, throttle: 1, brake: 0, gear: 'D' }).events;
    expect(sim.state.gear).toBe('D');
    for (let i = 0; i < 120; i++) events = step(sim, { steer: 0, throttle: 1, brake: 0, gear: 'D' }).events;
    expect(sim.state.v).toBeGreaterThan(1);
    expect(sim.state.moves).toBe(1);
    const r = step(sim, { steer: 0, throttle: 0, brake: 0, gear: 'R' });
    expect(r.events.some((e) => e.type === 'gearRefused')).toBe(true);
    expect(sim.state.gear).toBe('D');
    for (let i = 0; i < 200; i++) step(sim, { steer: 0, throttle: 0, brake: 1, gear: 'D' });
    expect(sim.state.v).toBe(0);
    step(sim, { steer: 0, throttle: 0, brake: 0, gear: 'R' });
    expect(sim.state.gear).toBe('R');
    for (let i = 0; i < 120; i++) step(sim, { steer: 0, throttle: 1, brake: 0, gear: 'R' });
    expect(sim.state.moves).toBe(2);
    void events;
  });
  it('stops at a collision and fails after three', () => {
    const sim = createSim(SCENARIOS[3]!); // ficka-stor, curb at y=0
    sim.state.pose = { x: 15, y: 1.2, heading: -Math.PI / 2 }; // pointing at the curb
    sim.state.gear = 'D';
    let collisions = 0;
    for (let i = 0; i < 600; i++) {
      const r = step(sim, { steer: 0, throttle: 1, brake: 0, gear: 'D' });
      collisions += r.events.filter((e) => e.type === 'collision').length;
    }
    expect(collisions).toBe(1);
    expect(sim.state.v).toBe(0);
    expect(sim.state.pose.y).toBeGreaterThan(0);
    expect(sim.state.collisions).toHaveLength(1);
  });
  it('runs through advance with an accumulator', () => {
    const sim = createSim(sandbox);
    advance(sim, { steer: 0, throttle: 1, brake: 0, gear: 'D' }, 1000 / 60);
    expect(sim.state.t).toBeCloseTo(FIXED_DT, 6);
    advance(sim, { steer: 0, throttle: 1, brake: 0, gear: 'D' }, 5000);
    expect(sim.state.t).toBeLessThan(0.2); // capped sub-steps
  });
});
