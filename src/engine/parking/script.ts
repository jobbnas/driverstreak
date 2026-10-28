import type { DriveStep, Scenario, SimEvent, Until, Vec } from './types';
import { createSim, step, type Sim } from './sim';
import { carCorners } from './car';
import { obstacleSegments } from './collision';
import { pointSegDist, obbCorners } from './geometry';
import { obstacleObb } from './collision';
import { deg, wrapAngle } from './vec';
import { createCoach, coachStep, type CoachState } from './coach';
import { outcomeOf, stars, poseError } from './scoring';
import type { Stars } from './types';

const MAX_STEP_S = 90;

function refPoint(sim: Sim, ref: string): Vec | undefined {
  const [id, part] = ref.split('.');
  const o = sim.scenario.obstacles.find((x) => x.id === id);
  if (!o || o.kind !== 'car') return undefined;
  const obb = obstacleObb(o);
  if (!obb) return undefined;
  const c = obbCorners(obb);
  if (part === 'rearBumper') return { x: (c[2].x + c[3].x) / 2, y: (c[2].y + c[3].y) / 2 };
  if (part === 'frontBumper') return { x: (c[0].x + c[1].x) / 2, y: (c[0].y + c[1].y) / 2 };
  return obb.c;
}

export function untilMet(sim: Sim, u: Until, startDistance: number): boolean {
  const s = sim.state;
  switch (u.kind) {
    case 'distance':
      return s.distance - startDistance >= u.m;
    case 'heading':
      return Math.abs(deg(wrapAngle(s.pose.heading - (u.deg * Math.PI) / 180))) <= 1.0;
    case 'x':
      return (u.le === undefined || s.pose.x <= u.le) && (u.ge === undefined || s.pose.x >= u.ge);
    case 'y':
      return (u.le === undefined || s.pose.y <= u.le) && (u.ge === undefined || s.pose.y >= u.ge);
    case 'inTarget': {
      const tg = sim.scenario.target;
      if (!tg) return false;
      return poseError(s.pose, tg, sim.spec, sim.scenario).grade === 3;
    }
    case 'axleLongitudinal': {
      const p = refPoint(sim, u.ref);
      if (!p) return false;
      const street = sim.scenario.target?.pose.heading ?? 0;
      const d = (s.pose.x - p.x) * Math.cos(street) + (s.pose.y - p.y) * Math.sin(street);
      return d <= u.le;
    }
    case 'cornerClears': {
      const p = refPoint(sim, u.ref);
      if (!p) return false;
      const c = carCorners(s.pose, sim.spec)[u.corner];
      const street = sim.scenario.target?.pose.heading ?? 0;
      const d = (c.x - p.x) * Math.cos(street) + (c.y - p.y) * Math.sin(street);
      return d <= -u.margin;
    }
    case 'cornerNear': {
      const c = carCorners(s.pose, sim.spec)[u.corner];
      const o = sim.scenario.obstacles.find((x) => x.id === u.obstacleId);
      if (!o) return false;
      let best = Infinity;
      for (const [a, b] of obstacleSegments(o)) best = Math.min(best, pointSegDist(c, a, b));
      return best <= u.within;
    }
  }
}

export interface ScriptResult {
  path: Vec[];
  final: Sim;
  cues: string[];
  events: SimEvent[];
  stars: Stars;
  warnings: string[];
}

/** Executes a scenario's ideal script through the real engine (instant steering, creep speed, stop between steps). */
export function runScript(scenario: Scenario, script: DriveStep[] = scenario.script): ScriptResult {
  const sim = createSim(scenario);
  const path: Vec[] = [{ x: sim.state.pose.x, y: sim.state.pose.y }];
  const events: SimEvent[] = [];
  const cues: string[] = [];
  const warnings: string[] = [];
  let coach: CoachState | undefined = scenario.coach !== 'none' ? createCoach(scenario) : undefined;
  let lastSample = path[0] as Vec;
  for (const st of script) {
    sim.state.v = 0;
    sim.state.gear = st.gear;
    sim.state.steer = st.steer * sim.spec.maxSteerRad;
    const startDistance = sim.state.distance;
    const t0 = sim.state.t;
    while (!untilMet(sim, st.until, startDistance)) {
      const r = step(sim, { steer: st.steer, throttle: 0, brake: 0, gear: st.gear });
      events.push(...r.events);
      if (coach) {
        const c = coachStep(coach, sim);
        coach = c.state;
        if (c.cue) cues.push(c.cue.id);
        if (c.warning) warnings.push(c.warning);
      }
      const p = sim.state.pose;
      if (Math.hypot(p.x - lastSample.x, p.y - lastSample.y) >= 0.05) {
        lastSample = { x: p.x, y: p.y };
        path.push(lastSample);
      }
      if (sim.state.t - t0 > MAX_STEP_S || sim.state.failed) break;
      if (r.events.some((e) => e.type === 'collision')) break;
    }
    if (sim.state.failed) break;
  }
  sim.state.v = 0;
  sim.state.stationaryS = 1;
  if (coach) {
    const c = coachStep(coach, sim);
    if (c.cue) cues.push(c.cue.id);
  }
  sim.state.finishedAt = sim.state.t;
  const outcome = outcomeOf(sim.state, scenario, sim.spec, true);
  return { path, final: sim, cues, events, stars: stars(outcome, scenario), warnings };
}
