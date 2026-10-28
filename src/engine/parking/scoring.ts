import type { CarSpec, Pose, Scenario, SimState, Stars, Target } from './types';
import { carCorners } from './car';
import { pointInPoly } from './geometry';
import { senseSides } from './sensors';
import { deg, wrapAngle } from './vec';

export interface PoseError {
  lon: number;
  lat: number;
  headingDeg: number;
  curbDist?: number;
  insideBay: boolean;
  bayOverrun: number;
  grade: Stars;
}

const CURB_KINDS = new Set<'curb' | 'wall'>(['curb', 'wall']);

export function poseError(pose: Pose, target: Target, spec: CarSpec, scenario: Scenario): PoseError {
  const th = target.pose.heading;
  const s = { x: Math.cos(th), y: Math.sin(th) };
  const n = { x: Math.sin(th), y: -Math.cos(th) }; // car's right
  const dx = pose.x - target.pose.x;
  const dy = pose.y - target.pose.y;
  const lon = dx * s.x + dy * s.y;
  const lat = dx * n.x + dy * n.y;
  const headingDeg = deg(wrapAngle(pose.heading - th));
  let curbDist: number | undefined;
  if (target.curb) {
    const sides = senseSides(pose, spec, scenario.obstacles, CURB_KINDS as ReadonlySet<'curb' | 'wall'>);
    curbDist = sides.right.d;
  }
  let insideBay = true;
  let bayOverrun = 0;
  if (target.bay) {
    const c = carCorners(pose, spec);
    for (const p of [c.fr, c.fl, c.rl, c.rr]) {
      if (!pointInPoly(p, target.bay)) {
        insideBay = false;
        bayOverrun = Math.max(bayOverrun, distanceOutside(p, target.bay));
      }
    }
  }
  const tol = target.tolerance;
  const lonOk = tol.lonFree ? true : Math.abs(lon) <= tol.lon;
  const tier = (i: 0 | 1 | 2): boolean => {
    if (!lonOk) return false;
    if (Math.abs(headingDeg) > (tol.headingDeg[i] as number)) return false;
    if (target.curb && curbDist !== undefined) {
      const [idealLo, idealHi] = target.curb.ideal;
      if (i === 0 && !(curbDist >= idealLo && curbDist <= idealHi)) return false;
      if (i > 0 && curbDist > (target.curb.max[i] as number)) return false;
      if (curbDist < 0.02) return false;
    } else if (Math.abs(lat) > (tol.lat[i] as number)) return false;
    if (target.bay) {
      if (i < 2 && !insideBay) return false;
      if (i === 2 && bayOverrun > 0.1) return false;
    }
    return true;
  };
  const grade: Stars = tier(0) ? 3 : tier(1) ? 2 : tier(2) ? 1 : 0;
  return { lon, lat, headingDeg, curbDist, insideBay, bayOverrun, grade };
}

function distanceOutside(p: { x: number; y: number }, poly: readonly { x: number; y: number }[]): number {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as { x: number; y: number };
    const b = poly[(i + 1) % poly.length] as { x: number; y: number };
    const abx = b.x - a.x;
    const aby = b.y - a.y;
    const l2 = abx * abx + aby * aby || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2));
    const d = Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
    if (d < best) best = d;
  }
  return best;
}

export interface Outcome {
  finished: boolean;
  failed: boolean;
  pose?: PoseError;
  collisions: number;
  moves: number;
  conesHit: number;
  timeMs: number;
}

export function collisionTier(n: number): Stars {
  return n === 0 ? 3 : n === 1 ? 2 : n === 2 ? 1 : 0;
}

export function movesTier(moves: number, par: number): Stars {
  return moves <= par ? 3 : moves <= par + 2 ? 2 : 1;
}

export function stars(outcome: Outcome, scenario: Scenario): Stars {
  if (outcome.failed || !outcome.finished) return 0;
  const r = scenario.rules;
  if (r.coneStars) {
    const [three, two] = r.coneStars;
    return outcome.conesHit <= three ? 3 : outcome.conesHit <= two ? 2 : 1;
  }
  const pose = outcome.pose?.grade ?? 0;
  if (pose === 0) return 0;
  let mv: Stars;
  if (r.movesStars) {
    const [a, b, c] = r.movesStars;
    mv = outcome.moves <= a ? 3 : outcome.moves <= b ? 2 : outcome.moves <= c ? 1 : 1;
  } else mv = movesTier(outcome.moves, r.parMoves);
  return Math.min(pose, collisionTier(outcome.collisions), mv) as Stars;
}

export function outcomeOf(state: SimState, scenario: Scenario, spec: CarSpec, finished: boolean): Outcome {
  const pose = scenario.target ? poseError(state.pose, scenario.target, spec, scenario) : undefined;
  return {
    finished,
    failed: !!state.failed,
    pose,
    collisions: state.collisions.length,
    moves: state.moves,
    conesHit: state.conesHit.length,
    timeMs: Math.round(((state.finishedAt ?? state.t) - (state.startedMoving ?? 0)) * 1000),
  };
}
