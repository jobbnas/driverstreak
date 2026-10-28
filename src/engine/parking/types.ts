export interface Vec {
  x: number;
  y: number;
}

/** Rear-axle midpoint pose in metres / radians. heading 0 = +x, positive = counter-clockwise. */
export interface Pose {
  x: number;
  y: number;
  heading: number;
}

export interface CarSpec {
  length: number;
  width: number;
  wheelbase: number;
  frontOverhang: number;
  track: number;
  maxSteerRad: number;
  steerRateRadPerS: number;
  accel: number;
  brakeDecel: number;
  creepSpeed: number;
  drag: number;
}

export type Gear = 'D' | 'N' | 'R';

export interface SimInput {
  /** -1..1, positive = left */
  steer: number;
  throttle: 0 | 1;
  brake: 0 | 1;
  gear: Gear;
}

export type Obstacle =
  | { id: string; kind: 'car'; pose: Pose; length: number; width: number; color: string; name?: string }
  | { id: string; kind: 'curb'; points: Vec[] }
  | { id: string; kind: 'wall'; a: Vec; b: Vec; height?: number }
  | { id: string; kind: 'cone'; at: Vec }
  | { id: string; kind: 'cart'; pose: Pose };

export interface Marking {
  kind: 'bay' | 'line' | 'sightline' | 'chalk';
  points: Vec[];
  width?: number;
  dashed?: boolean;
}

export interface Target {
  /** Ideal rear-axle pose. */
  pose: Pose;
  tolerance: {
    lon: number;
    lat: [number, number, number];
    headingDeg: [number, number, number];
    /** Allowed longitudinal range when lon is free (e.g. hornet: y <= -8). */
    lonFree?: boolean;
  };
  bay?: Vec[];
  curb?: { side: 'right'; ideal: [number, number]; max: [number, number, number] };
}

export type ScenarioId =
  | 'sandlada'
  | 'nos-ruta'
  | 'back-ruta'
  | 'ficka-stor'
  | 'ficka-trang'
  | 'hornet'
  | 'trepunkt'
  | 'gamla-uppsala';

export type CoachKind = 'ficka' | 'hornet' | 'ruta' | 'none';

export type Until =
  | { kind: 'distance'; m: number }
  | { kind: 'heading'; deg: number }
  | { kind: 'axleLongitudinal'; ref: string; le: number }
  | { kind: 'cornerClears'; corner: 'fr' | 'fl' | 'rr' | 'rl'; ref: string; margin: number }
  | { kind: 'cornerNear'; corner: 'fr' | 'fl' | 'rr' | 'rl'; obstacleId: string; within: number }
  | { kind: 'inTarget' }
  | { kind: 'x'; le?: number; ge?: number }
  | { kind: 'y'; le?: number; ge?: number };

export interface DriveStep {
  gear: 'D' | 'R';
  steer: number;
  until: Until;
}

export interface ScenarioRules {
  maxSpeedKmh: number;
  parMoves: number;
  coachingAvailable: boolean;
  coneIsScratch: boolean;
  /** Stars by moves for scenarios where moves are the whole point (trepunkt). */
  movesStars?: [number, number, number];
  /** Stars by cones hit (sandlada). */
  coneStars?: [number, number];
}

export interface Scenario {
  id: ScenarioId;
  order: number;
  title: string;
  subtitle: string;
  emoji: string;
  intro: string;
  world: { w: number; h: number; sidewalks?: Vec[][]; buildings?: { at: Vec; w: number; d: number; h: number }[] };
  start: Pose;
  obstacles: Obstacle[];
  markings: Marking[];
  target?: Target;
  rules: ScenarioRules;
  coach: CoachKind;
  coachParams?: { turnX?: number; refCarId?: string; bayLineY?: number; curbId?: string; angleDeg?: number; rrWithin?: number; alignOffset?: number };
  script: DriveStep[];
}

export interface Hit {
  obstacleId: string;
  kind: Obstacle['kind'];
  point: Vec;
  speed: number;
  severity: 'scratch' | 'bumper';
}

export type Side = 'front' | 'rear' | 'left' | 'right';
export type SideDistances = Record<Side, { d: number; point?: Vec; obstacleId?: string }>;

export interface SimState {
  t: number;
  pose: Pose;
  v: number;
  /** actual road-wheel angle in radians */
  steer: number;
  gear: Gear;
  moves: number;
  lastDir: 0 | 1 | -1;
  segDist: number;
  distance: number;
  collisions: Hit[];
  contacts: Record<string, number>;
  failed?: 'collisions';
  sensors: SideDistances;
  inTarget: boolean;
  stationaryS: number;
  conesHit: string[];
  startedMoving?: number;
  finishedAt?: number;
  overspeedS: number;
}

export type SimEvent =
  | { type: 'collision'; hit: Hit; count: number }
  | { type: 'move'; moves: number; dir: 1 | -1 }
  | { type: 'gearRefused' }
  | { type: 'overspeed' }
  | { type: 'enterTarget' }
  | { type: 'leaveTarget' }
  | { type: 'fail'; reason: 'collisions' };

export type Stars = 0 | 1 | 2 | 3;
