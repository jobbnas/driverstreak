import type { CarSpec, Pose, Vec } from './types';
import { obbCorners, type Obb } from './geometry';
import { add, clamp, heading as dirOf, rot, v, wrapAngle } from './vec';

/** Skoda Octavia-ish. */
export const DEFAULT_CAR: CarSpec = {
  length: 4.7,
  width: 1.83,
  wheelbase: 2.68,
  frontOverhang: 0.9,
  track: 1.55,
  maxSteerRad: (35 * Math.PI) / 180,
  steerRateRadPerS: 0.9,
  accel: 1.5,
  brakeDecel: 4.0,
  creepSpeed: 0.8,
  drag: 0.6,
};

export function rearOverhang(spec: CarSpec): number {
  return spec.length - spec.wheelbase - spec.frontOverhang;
}

/** Longitudinal offset from the rear axle to the body centre. */
export function bodyCentreOffset(spec: CarSpec): number {
  return spec.wheelbase / 2 + (spec.frontOverhang - rearOverhang(spec)) / 2;
}

export function carObb(pose: Pose, spec: CarSpec): Obb {
  const c = add({ x: pose.x, y: pose.y }, rot(v(bodyCentreOffset(spec), 0), pose.heading));
  return { c, hx: spec.length / 2, hy: spec.width / 2, ang: pose.heading };
}

export function carCorners(pose: Pose, spec: CarSpec): { fr: Vec; fl: Vec; rl: Vec; rr: Vec } {
  const [fr, fl, rl, rr] = obbCorners(carObb(pose, spec));
  return { fr, fl, rl, rr };
}

export function wheelPositions(pose: Pose, spec: CarSpec): { fl: Vec; fr: Vec; rl: Vec; rr: Vec } {
  const p = { x: pose.x, y: pose.y };
  const h = pose.heading;
  const t = spec.track / 2;
  return {
    rl: add(p, rot(v(0, t), h)),
    rr: add(p, rot(v(0, -t), h)),
    fl: add(p, rot(v(spec.wheelbase, t), h)),
    fr: add(p, rot(v(spec.wheelbase, -t), h)),
  };
}

/** Rear-axle turning radius at full lock. */
export function minTurnRadius(spec: CarSpec): number {
  return spec.wheelbase / Math.tan(spec.maxSteerRad);
}

/** Exact-arc kinematic bicycle update of the pose. */
export function integratePose(pose: Pose, vel: number, steer: number, dt: number, spec: CarSpec): Pose {
  const ds = vel * dt;
  if (Math.abs(steer) < 1e-4) {
    const d = dirOf(pose.heading);
    return { x: pose.x + d.x * ds, y: pose.y + d.y * ds, heading: pose.heading };
  }
  const R = spec.wheelbase / Math.tan(steer);
  const dTheta = ds / R;
  const th = pose.heading;
  return {
    x: pose.x + R * (Math.sin(th + dTheta) - Math.sin(th)),
    y: pose.y - R * (Math.cos(th + dTheta) - Math.cos(th)),
    heading: wrapAngle(th + dTheta),
  };
}

export function stepSteer(current: number, targetNorm: number, dt: number, spec: CarSpec): number {
  const target = clamp(targetNorm, -1, 1) * spec.maxSteerRad;
  const maxDelta = spec.steerRateRadPerS * dt;
  return current + clamp(target - current, -maxDelta, maxDelta);
}

export function stepSpeed(vel: number, dir: 0 | 1 | -1, throttle: boolean, brake: boolean, vMax: number, dt: number, spec: CarSpec): number {
  const toward = (target: number, rate: number) => {
    const delta = target - vel;
    const step = rate * dt;
    return Math.abs(delta) <= step ? target : vel + Math.sign(delta) * step;
  };
  let next: number;
  if (brake) next = toward(0, spec.brakeDecel);
  else if (dir !== 0 && throttle) next = toward(dir * vMax, spec.accel);
  else if (dir !== 0) next = toward(dir * spec.creepSpeed, spec.accel * 0.5);
  else next = toward(0, spec.drag);
  return clamp(next, -vMax, vMax);
}
