import type { CarSpec, Obstacle, Pose, Side, SideDistances, Vec } from './types';
import { carCorners } from './car';
import { segSegDist } from './geometry';
import { obstacleSegments } from './collision';

export const SENSOR_RANGE = 3.0;

export function senseSides(pose: Pose, spec: CarSpec, obstacles: readonly Obstacle[], kinds?: ReadonlySet<Obstacle['kind']>): SideDistances {
  const c = carCorners(pose, spec);
  const edges: Record<Side, [Vec, Vec]> = {
    front: [c.fr, c.fl],
    left: [c.fl, c.rl],
    rear: [c.rl, c.rr],
    right: [c.rr, c.fr],
  };
  const out = {} as SideDistances;
  for (const side of ['front', 'rear', 'left', 'right'] as Side[]) {
    out[side] = { d: Infinity };
  }
  for (const o of obstacles) {
    if (kinds && !kinds.has(o.kind)) continue;
    for (const [a, b] of obstacleSegments(o)) {
      for (const side of ['front', 'rear', 'left', 'right'] as Side[]) {
        const [e1, e2] = edges[side];
        const r = segSegDist(e1, e2, a, b);
        if (r.d < out[side].d) out[side] = { d: r.d, point: r.point, obstacleId: o.id };
      }
    }
  }
  for (const side of ['front', 'rear', 'left', 'right'] as Side[]) {
    if (out[side].d > SENSOR_RANGE) out[side] = { d: Infinity };
  }
  return out;
}
