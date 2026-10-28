import type { Obstacle, Scenario, Vec } from './types';
import type { Sim } from './sim';
import { carCorners } from './car';
import { obstacleObb, obstacleSegments } from './collision';
import { obbCorners, pointSegDist } from './geometry';
import { deg, wrapAngle } from './vec';

export interface Cue {
  id: string;
  text: string;
}

export interface CoachState {
  kind: Scenario['coach'];
  stage: number;
  lastWarningAt: Record<string, number>;
  done: boolean;
  /** Rear-axle x when the user drove forward in a reversing stage (recover detection). */
  forwardSince?: number;
}

export function createCoach(scenario: Scenario): CoachState {
  return { kind: scenario.coach, stage: 0, lastWarningAt: {}, done: false };
}

function cornerDistTo(sim: Sim, corner: 'fr' | 'fl' | 'rr' | 'rl', obstacleId: string): number {
  const c = carCorners(sim.state.pose, sim.spec)[corner];
  const o = sim.scenario.obstacles.find((x) => x.id === obstacleId);
  if (!o) return Infinity;
  let best = Infinity;
  for (const [a, b] of obstacleSegments(o)) best = Math.min(best, pointSegDist(c, a, b));
  return best;
}

function rearBumperOf(o: Obstacle): Vec | undefined {
  const obb = obstacleObb(o);
  if (!obb) return undefined;
  const c = obbCorners(obb);
  return { x: (c[2].x + c[3].x) / 2, y: (c[2].y + c[3].y) / 2 };
}

const FICKA: Cue[] = [
  { id: 'approach', text: 'Kör fram jämsides med bilen framför, ungefär en meter ifrån, bakre stötfångarna i linje (lite längre fram i en trång lucka). Lägg i R.' },
  { id: 'straightBack', text: 'Backa sakta rakt bakåt.' },
  { id: 'fullRight', text: 'Nu: fullt utslag åt höger.' },
  { id: 'straighten', text: 'Räta upp hjulen och backa vidare.' },
  { id: 'fullLeft', text: 'Fullt utslag åt vänster.' },
  { id: 'straightenStop', text: 'Räta upp och stanna. Kör fram och centrera om du står nära bilen bakom.' },
  { id: 'done', text: 'Klart. Lägg i P.' },
];

const HORNET: Cue[] = [
  { id: 'straight', text: 'Backa rakt. Håll 0,5–1 m från kantstenen och titta bakåt.' },
  { id: 'turnIn', text: 'Nu: fullt utslag åt höger.' },
  { id: 'straighten', text: 'Räta upp.' },
  { id: 'straightOut', text: 'Backa rakt, lika långt från kantstenen som förut.' },
  { id: 'done', text: 'Stanna. Klart.' },
];

const RUTA_IN: Cue[] = [
  { id: 'approach', text: 'Kör fram i mittgången. Håll ögonen på den lediga rutan.' },
  { id: 'fullRight', text: 'Nu: fullt utslag åt höger.' },
  { id: 'straighten', text: 'Räta upp när bilen pekar rakt in i rutan.' },
  { id: 'done', text: 'Stanna när du står mitt i rutan. Lägg i P.' },
];

const RUTA_BACK: Cue[] = [
  { id: 'approach', text: 'Stanna när bakaxeln är en bit förbi rutan. Lägg i R.' },
  { id: 'fullRight', text: 'Fullt utslag åt höger och backa sakta.' },
  { id: 'straighten', text: 'Räta upp när bilen pekar rakt in i rutan.' },
  { id: 'done', text: 'Backa tills du står mitt i rutan. Lägg i P.' },
];

export interface CoachResult {
  state: CoachState;
  cue?: Cue;
  warning?: string;
}

function warn(state: CoachState, sim: Sim, id: string, text: string, every = 3): string | undefined {
  const last = state.lastWarningAt[id] ?? -Infinity;
  if (sim.state.t - last < every) return undefined;
  state.lastWarningAt[id] = sim.state.t;
  return text;
}

export function coachStep(prev: CoachState, sim: Sim): CoachResult {
  const state: CoachState = { ...prev, lastWarningAt: { ...prev.lastWarningAt } };
  if (state.done) return { state };
  const s = sim.state;
  const sc = sim.scenario;
  const p = sc.coachParams ?? {};

  if (state.kind === 'ficka') {
    const F = sc.obstacles.find((o) => o.id === (p.refCarId ?? 'F'));
    const rb = F && F.kind === 'car' ? rearBumperOf(F) : undefined;
    if (!F || F.kind !== 'car' || !rb) return { state };
    const street = F.pose.heading;
    const sx = Math.cos(street);
    const sy = Math.sin(street);
    const nx = Math.sin(street);
    const ny = -Math.cos(street);
    const u = (s.pose.x - rb.x) * sx + (s.pose.y - rb.y) * sy; // axle ahead of F's rear bumper
    const phi = deg(wrapAngle(s.pose.heading - street));
    const gapLat = (s.pose.x - F.pose.x) * nx + (s.pose.y - F.pose.y) * ny; // negative = we are left of F (further from curb)
    const sideGap = -gapLat - F.width / 2 - sim.spec.width / 2;
    const rrCurb = cornerDistTo(sim, 'rr', p.curbId ?? 'kant');
    const emit = (stage: number): CoachResult => {
      state.stage = stage;
      const cue = FICKA[stage] as Cue;
      if (cue.id === 'done') state.done = true;
      return { state, cue };
    };
    if (prev.stage === 0 && prev.lastWarningAt['__init'] === undefined) {
      state.lastWarningAt['__init'] = s.t;
      return { state, cue: FICKA[0] };
    }
    let warning: string | undefined;
    const rearIsCar = s.sensors.rear.obstacleId !== undefined && sc.obstacles.find((o) => o.id === s.sensors.rear.obstacleId)?.kind === 'car';
    const angleDeg = p.angleDeg ?? 30;
    if (s.gear === 'R' && rrCurb < 0.12) warning = warn(state, sim, 'curb', 'Kantstenen! Stanna.');
    else if (s.gear === 'R' && rearIsCar && s.sensors.rear.d < 0.3) warning = warn(state, sim, 'rear', 'Stopp, bilen bakom.');
    else if (state.stage >= 2 && state.stage <= 4 && phi > angleDeg + 20) warning = warn(state, sim, 'angle', 'För mycket vinkel. Räta upp.');
    switch (state.stage) {
      case 0:
        if (Math.abs(u - (1.12 + (p.alignOffset ?? 0))) <= 0.7 && sideGap >= 0.3 && sideGap <= 1.4 && Math.abs(phi) < 6 && s.gear === 'R') return emit(1);
        break;
      case 1:
        if (u <= 0.05 && s.gear === 'R') return emit(2);
        break;
      case 2:
        if (phi >= angleDeg - 3) return emit(3);
        if (s.gear === 'R' && s.segDist > 1.0 && s.steer > -0.9 * sim.spec.maxSteerRad) warning = warn(state, sim, 'lock', 'Mer utslag, hela vägen.');
        break;
      case 3:
        if (rrCurb <= (p.rrWithin ?? 0.45) + 0.04) return emit(4);
        break;
      case 4:
        if (phi <= 3) return emit(5);
        break;
      case 5:
        if (s.inTarget && s.stationaryS > 0.5) return emit(6);
        break;
    }
    if (state.stage >= 2 && state.stage <= 4 && s.gear === 'D' && s.lastDir === 1 && s.segDist > 0.5) {
      state.stage = 2;
      return { state, cue: { id: 'recover', text: `Kör fram, räta upp, och ta det igen från ${angleDeg} grader.` }, warning };
    }
    return { state, warning };
  }

  if (state.kind === 'hornet') {
    const turnX = p.turnX ?? 0;
    const h = deg(s.pose.heading);
    const rrCurb = cornerDistTo(sim, 'rr', p.curbId ?? 'kant');
    const emit = (stage: number): CoachResult => {
      state.stage = stage;
      const cue = HORNET[stage] as Cue;
      if (cue.id === 'done') state.done = true;
      return { state, cue };
    };
    if (prev.lastWarningAt['__init'] === undefined) {
      state.lastWarningAt['__init'] = s.t;
      return { state, cue: HORNET[0] };
    }
    let warning: string | undefined;
    if (rrCurb < 0.25) warning = warn(state, sim, 'curb', 'Kantstenen! Stanna och kör fram lite.');
    else if (state.stage === 3 && s.sensors.right.d > 1.3) warning = warn(state, sim, 'far', 'Du är långt från kantstenen. Styr lite åt höger.');
    switch (state.stage) {
      case 0:
        if (s.pose.x <= turnX + 0.15 && s.gear === 'R') return emit(1);
        break;
      case 1:
        if (h >= 80) return emit(2);
        break;
      case 2:
        if (Math.abs(h - 90) <= 4) return emit(3);
        break;
      case 3:
        if (s.inTarget && s.stationaryS > 0.5) return emit(4);
        break;
    }
    return { state, warning };
  }

  if (state.kind === 'ruta') {
    const cues = sc.id === 'nos-ruta' ? RUTA_IN : RUTA_BACK;
    const turnX = p.turnX ?? 0;
    const h = deg(s.pose.heading);
    const targetH = deg(sc.target?.pose.heading ?? 0);
    const emit = (stage: number): CoachResult => {
      state.stage = stage;
      const cue = cues[stage] as Cue;
      if (cue.id === 'done') state.done = true;
      return { state, cue };
    };
    if (prev.lastWarningAt['__init'] === undefined) {
      state.lastWarningAt['__init'] = s.t;
      return { state, cue: cues[0] };
    }
    let warning: string | undefined;
    const minSide = Math.min(s.sensors.left.d, s.sensors.right.d);
    if (minSide < 0.12) warning = warn(state, sim, 'side', 'Nära grannbilen. Stanna och rätta till.');
    switch (state.stage) {
      case 0:
        if (sc.id === 'nos-ruta' ? s.pose.x >= turnX - 0.15 : s.gear === 'R') return emit(1);
        break;
      case 1:
        if (Math.abs(deg(wrapAngle(s.pose.heading - (targetH * Math.PI) / 180))) <= 12) return emit(2);
        break;
      case 2:
        if (s.inTarget && s.stationaryS > 0.5) return emit(3);
        break;
    }
    void h;
    return { state, warning };
  }

  return { state };
}
