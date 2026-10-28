import type { CarSpec, Gear, Hit, Scenario, SimEvent, SimInput, SimState, Target } from './types';
import { DEFAULT_CAR, carCorners, integratePose, stepSpeed, stepSteer } from './car';
import { collide } from './collision';
import { senseSides } from './sensors';
import { pointInPoly, pointInObb } from './geometry';
import { wrapAngle } from './vec';
import { poseError } from './scoring';

export const FIXED_DT = 1 / 60;
const MOVE_CONFIRM_M = 0.15;
const GEAR_CHANGE_MAX_V = 0.3;
const CONTACT_RELEASE_S = 0.5;

export interface Sim {
  scenario: Scenario;
  spec: CarSpec;
  state: SimState;
  accumulator: number;
}

export function createSim(scenario: Scenario, spec: CarSpec = DEFAULT_CAR): Sim {
  const state: SimState = {
    t: 0,
    pose: { ...scenario.start },
    v: 0,
    steer: 0,
    gear: 'N',
    moves: 0,
    lastDir: 0,
    segDist: 0,
    distance: 0,
    collisions: [],
    contacts: {},
    sensors: senseSides(scenario.start, spec, scenario.obstacles),
    inTarget: false,
    stationaryS: 0,
    conesHit: [],
    overspeedS: 0,
  };
  return { scenario, spec, state, accumulator: 0 };
}

export function dirOfGear(g: Gear): 0 | 1 | -1 {
  return g === 'D' ? 1 : g === 'R' ? -1 : 0;
}

export function isInTarget(state: Pick<SimState, 'pose' | 'sensors'>, target: Target | undefined, spec: CarSpec, scenario: Scenario): boolean {
  if (!target) return false;
  const e = poseError(state.pose, target, spec, scenario);
  return e.grade > 0;
}

/** One fixed physics step. Returns the new state and the events it produced. */
export function step(sim: Sim, input: SimInput, dt = FIXED_DT): { state: SimState; events: SimEvent[] } {
  const { scenario, spec } = sim;
  const prev = sim.state;
  const events: SimEvent[] = [];
  const s: SimState = { ...prev, collisions: prev.collisions, contacts: { ...prev.contacts }, conesHit: prev.conesHit };
  s.t = prev.t + dt;

  // gear change
  if (input.gear !== prev.gear) {
    if (Math.abs(prev.v) <= GEAR_CHANGE_MAX_V) s.gear = input.gear;
    else events.push({ type: 'gearRefused' });
  }
  const dir = dirOfGear(s.gear);
  const vMax = scenario.rules.maxSpeedKmh / 3.6;

  s.steer = stepSteer(prev.steer, input.steer, dt, spec);
  s.v = stepSpeed(prev.v, dir, input.throttle === 1, input.brake === 1, vMax, dt, spec);

  // overspeed (only when the cap is reached for a while)
  if (Math.abs(s.v) >= vMax - 0.05 && input.throttle) {
    s.overspeedS = prev.overspeedS + dt;
    if (prev.overspeedS < 2 && s.overspeedS >= 2) events.push({ type: 'overspeed' });
  } else s.overspeedS = 0;

  // pose
  const nextPose = integratePose(prev.pose, s.v, s.steer, dt, spec);
  const hits = collide(nextPose, spec, scenario.obstacles, s.v);
  if (hits.length > 0) {
    s.pose = prev.pose;
    s.v = 0;
    const newHits: Hit[] = [];
    for (const h of hits) {
      if (prev.contacts[h.obstacleId] === undefined) newHits.push(h);
      s.contacts[h.obstacleId] = s.t;
    }
    if (newHits.length) {
      const counted = newHits.filter((h) => !(h.kind === 'cone' && !scenario.rules.coneIsScratch));
      for (const h of newHits) {
        if (h.kind === 'cone' && !s.conesHit.includes(h.obstacleId)) s.conesHit = [...s.conesHit, h.obstacleId];
      }
      if (counted.length) {
        s.collisions = [...prev.collisions, ...counted];
        for (const h of counted) events.push({ type: 'collision', hit: h, count: s.collisions.length });
        if (s.collisions.length >= 3 && !prev.failed) {
          s.failed = 'collisions';
          events.push({ type: 'fail', reason: 'collisions' });
        }
      } else {
        for (const h of newHits) events.push({ type: 'collision', hit: h, count: s.collisions.length });
      }
    }
  } else {
    s.pose = nextPose;
  }
  // release contacts that have not been touched for a while
  for (const id of Object.keys(s.contacts)) {
    if (s.t - (s.contacts[id] ?? 0) > CONTACT_RELEASE_S && !hits.some((h) => h.obstacleId === id)) delete s.contacts[id];
  }

  // distance and moves
  const ds = Math.abs(s.v) * dt;
  s.distance = prev.distance + ds;
  const moveDir: 0 | 1 | -1 = s.v > 1e-6 ? 1 : s.v < -1e-6 ? -1 : 0;
  if (moveDir !== 0) {
    if (moveDir !== prev.lastDir) {
      s.segDist = ds;
      s.lastDir = moveDir;
    } else {
      s.segDist = prev.segDist + ds;
      if (prev.segDist < MOVE_CONFIRM_M && s.segDist >= MOVE_CONFIRM_M) {
        s.moves = prev.moves + 1;
        events.push({ type: 'move', moves: s.moves, dir: moveDir });
        if (s.startedMoving === undefined) s.startedMoving = s.t;
      }
    }
  }
  s.stationaryS = Math.abs(s.v) < 0.02 ? prev.stationaryS + dt : 0;

  // sensors and target
  s.sensors = senseSides(s.pose, spec, scenario.obstacles);
  s.inTarget = isInTarget(s, scenario.target, spec, scenario);
  if (s.inTarget && !prev.inTarget) events.push({ type: 'enterTarget' });
  if (!s.inTarget && prev.inTarget) events.push({ type: 'leaveTarget' });

  sim.state = s;
  return { state: s, events };
}

/** Advance by wall-clock time with a fixed-step accumulator; at most `maxSteps` sub-steps. */
export function advance(sim: Sim, input: SimInput, elapsedMs: number, maxSteps = 6): SimEvent[] {
  sim.accumulator += Math.min(elapsedMs, 100) / 1000;
  const events: SimEvent[] = [];
  let n = 0;
  while (sim.accumulator >= FIXED_DT && n < maxSteps) {
    events.push(...step(sim, input).events);
    sim.accumulator -= FIXED_DT;
    n++;
  }
  if (n >= maxSteps) sim.accumulator = 0;
  return events;
}

export function cornersInsideChalk(sim: Sim): boolean {
  const chalk = sim.scenario.markings.find((m) => m.kind === 'chalk');
  if (!chalk) return false;
  const c = carCorners(sim.state.pose, sim.spec);
  return [c.fr, c.fl, c.rl, c.rr].every((p) => pointInPoly(p, chalk.points));
}

export { wrapAngle, pointInObb };
