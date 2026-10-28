import type { Marking, Obstacle, Pose, Scenario, Vec } from './types';
import { arcPoints } from './geometry';
import { rad } from './vec';

const CAR_L = 4.7;
const CAR_W = 1.83;
/** Longitudinal offset rear axle -> body centre for the default car. */
const AXLE_TO_CENTRE = 1.23;

export const CAR_COLORS = ['#c0392b', '#2c3e50', '#95a5a6', '#f1c40f', '#8e44ad', '#16a085', '#ecf0f1', '#d35400'];

export function parkedCar(id: string, cx: number, cy: number, headingDeg: number, color: string, name?: string, length = CAR_L, width = CAR_W): Obstacle {
  return { id, kind: 'car', pose: { x: cx, y: cy, heading: rad(headingDeg) }, length, width, color, name };
}

export function curb(id: string, points: Vec[]): Obstacle {
  return { id, kind: 'curb', points };
}

export function cone(id: string, x: number, y: number): Obstacle {
  return { id, kind: 'cone', at: { x, y } };
}

export function bayMarking(x: number, y: number, w: number, l: number): Marking {
  return { kind: 'bay', points: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + l }, { x, y: y + l }] };
}

function rect(x: number, y: number, w: number, h: number): Vec[] {
  return [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
}

/** Body centre -> rear axle pose for a target car standing at heading. */
function axleFromCentre(cx: number, cy: number, headingDeg: number): Pose {
  const h = rad(headingDeg);
  return { x: cx - AXLE_TO_CENTRE * Math.cos(h), y: cy - AXLE_TO_CENTRE * Math.sin(h), heading: h };
}

// ---------- 1. Sandlåda ----------
const sandlada: Scenario = {
  id: 'sandlada',
  order: 1,
  title: 'Sandlådan',
  subtitle: 'Tom plan, koner och en kritruta. Lär känna bilen.',
  emoji: '🧡',
  intro: 'Kör slalom mellan konerna, genom porten och stanna inne i kritrutan. Här får du köra 15 km/h och konerna kostar inget.',
  world: { w: 30, h: 30 },
  start: { x: 3, y: 20, heading: 0 },
  obstacles: [
    ...[6, 10, 14, 18, 22, 26].map((x, i) => cone(`k${i}`, x, 15)),
    cone('p1', 24.7, 8),
    cone('p2', 27.3, 8),
    cone('e1', 2, 2),
    cone('e2', 28, 28),
  ],
  markings: [{ kind: 'chalk', points: rect(5, 4.5, 6, 3) }, { kind: 'line', points: [{ x: 6, y: 15 }, { x: 26, y: 15 }], dashed: true }],
  rules: { maxSpeedKmh: 15, parMoves: 0, coachingAvailable: false, coneIsScratch: false, coneStars: [0, 2] },
  coach: 'none',
  script: [],
};

// ---------- 2 & 3. Parkeringsrutor ----------
function lot(withCarsInBays: number[], names = false, farCurbY = 12): { obstacles: Obstacle[]; markings: Marking[] } {
  const obstacles: Obstacle[] = [];
  const markings: Marking[] = [];
  for (let k = 0; k < 7; k++) {
    const x = 4 + 2.5 * k;
    markings.push(bayMarking(x, 0, 2.5, 5));
    if (withCarsInBays.includes(k)) {
      obstacles.push(parkedCar(`bay${k}`, x + 1.25, 2.5, 90, CAR_COLORS[k % CAR_COLORS.length] as string, names ? `Bil ${k + 1}` : undefined));
    }
  }
  obstacles.push(curb('kant-bak', [{ x: 0, y: 0 }, { x: 26, y: 0 }]));
  obstacles.push(curb('kant-fram', [{ x: 0, y: farCurbY }, { x: 26, y: farCurbY }]));
  return { obstacles, markings };
}

const nosRuta: Scenario = {
  id: 'nos-ruta',
  order: 2,
  title: 'Nosparkering i ruta',
  subtitle: 'Sväng in framåt mellan två bilar.',
  emoji: '🅿️',
  intro: 'Kör in framåt i den lediga rutan. Håll dig på bortre sidan av gången, börja svängen när din bakaxel är i höjd med rutan före, sväng fullt och räta upp när bilen pekar in i rutan.',
  world: { w: 26, h: 16 },
  start: { x: 3, y: 11.5, heading: 0 },
  ...lot([0, 1, 2, 4, 5, 6], false, 13.2),
  target: {
    pose: axleFromCentre(12.75, 2.5, -90),
    tolerance: { lon: 0.4, lat: [0.15, 0.3, 0.5], headingDeg: [4, 7, 10] },
    bay: rect(11.5, 0, 2.5, 5),
  },
  rules: { maxSpeedKmh: 8, parMoves: 2, coachingAvailable: true, coneIsScratch: true },
  coach: 'ruta',
  coachParams: { turnX: 8.92, bayLineY: 5 },
  script: [
    { gear: 'D', steer: 0, until: { kind: 'x', ge: 8.92 } },
    { gear: 'D', steer: -1, until: { kind: 'heading', deg: -90 } },
    { gear: 'D', steer: 0, until: { kind: 'inTarget' } },
  ],
};

const backRuta: Scenario = {
  id: 'back-ruta',
  order: 3,
  title: 'Backa in i ruta',
  subtitle: 'Den vanligaste parkeringen på provet.',
  emoji: '↩️',
  intro: 'Kör förbi rutan, stanna, lägg i backen och sväng fullt så att bakändan går in mellan bilarna. Räta upp när bilen pekar rakt in.',
  world: { w: 26, h: 14 },
  start: { x: 16.58, y: 8.25, heading: 0 },
  ...lot([2, 4]),
  target: {
    pose: axleFromCentre(12.75, 2.5, 90),
    tolerance: { lon: 0.4, lat: [0.15, 0.3, 0.5], headingDeg: [4, 7, 10] },
    bay: rect(11.5, 0, 2.5, 5),
  },
  rules: { maxSpeedKmh: 8, parMoves: 2, coachingAvailable: true, coneIsScratch: true },
  coach: 'ruta',
  coachParams: { turnX: 16.58, bayLineY: 5 },
  script: [
    { gear: 'R', steer: -1, until: { kind: 'heading', deg: 90 } },
    { gear: 'R', steer: 0, until: { kind: 'inTarget' } },
  ],
};

// ---------- 4 & 5. Fickparkering ----------
function street(gap: number, laneY: number): { obstacles: Obstacle[]; markings: Marking[]; targetX: number; frontCarRear: number } {
  const bCentre = 8;
  const fCentre = bCentre + CAR_L + gap;
  const parkedY = CAR_W / 2 + 0.25;
  const obstacles: Obstacle[] = [
    curb('kant', [{ x: 0, y: 0 }, { x: 40, y: 0 }]),
    curb('kant-andra', [{ x: 0, y: 9.5 }, { x: 40, y: 9.5 }]),
    parkedCar('B', bCentre, parkedY, 0, '#2c3e50', 'Bilen bakom'),
    parkedCar('F', fCentre, parkedY, 0, '#c0392b', 'Bilen framför'),
    parkedCar('O1', 14, 9.5 - parkedY, 180, '#95a5a6'),
    parkedCar('O2', 30, 9.5 - parkedY, 180, '#f1c40f'),
  ];
  const markings: Marking[] = [{ kind: 'line', points: [{ x: 0, y: laneY + 1.5 }, { x: 40, y: laneY + 1.5 }], dashed: true }];
  return { obstacles, markings, targetX: (bCentre + CAR_L / 2 + fCentre - CAR_L / 2) / 2, frontCarRear: fCentre - CAR_L / 2 };
}

function ficka(id: 'ficka-stor' | 'ficka-trang', order: number, gapFactor: number, title: string, subtitle: string, par: number, angleDeg: number, rrWithin: number, alignOffset = 0): Scenario {
  const gap = CAR_L * gapFactor;
  const laneY = 4.0;
  const s = street(gap, laneY);
  const alignX = s.frontCarRear + 1.12 + alignOffset; // our rear bumper level with F's rear bumper (+ offset)
  return {
    id,
    order,
    title,
    subtitle,
    emoji: '🚗',
    intro:
      alignOffset > 0
        ? 'Trång lucka: stanna med din bakre stötfångare drygt en halvmeter framför bilens framför. Backa med fullt högerutslag till cirka 30 grader, räta upp, och fullt vänster när bakhjulet närmar sig kantstenen.'
        : 'Kör fram och stanna jämsides med bilen framför, ungefär en meter ifrån, med bakre stötfångarna i linje. Backa med fullt högerutslag till cirka 30 grader, räta upp, och lägg fullt vänsterutslag när bakhjulet närmar sig kantstenen.',
    world: { w: 40, h: 16, sidewalks: [rect(0, -3, 40, 3), rect(0, 9.5, 40, 3)], buildings: [{ at: { x: 10, y: -6 }, w: 12, d: 5, h: 6 }, { at: { x: 28, y: -6 }, w: 9, d: 5, h: 4 }] },
    start: { x: 10, y: laneY, heading: 0 },
    obstacles: s.obstacles,
    markings: s.markings,
    target: {
      pose: { x: s.targetX - AXLE_TO_CENTRE, y: CAR_W / 2 + 0.25, heading: 0 },
      tolerance: { lon: gap / 2 - CAR_L / 2 - 0.25, lat: [0.3, 0.5, 0.8], headingDeg: [3, 6, 10] },
      curb: { side: 'right', ideal: [0.08, 0.45], max: [0.45, 0.65, 0.95] },
    },
    rules: { maxSpeedKmh: 8, parMoves: par, coachingAvailable: true, coneIsScratch: true },
    coach: 'ficka',
    coachParams: { refCarId: 'F', curbId: 'kant', angleDeg, rrWithin, alignOffset },
    script: [
      { gear: 'D', steer: 0, until: { kind: 'x', ge: alignX } },
      { gear: 'R', steer: -1, until: { kind: 'heading', deg: angleDeg } },
      { gear: 'R', steer: 0, until: { kind: 'cornerNear', corner: 'rr', obstacleId: 'kant', within: rrWithin } },
      { gear: 'R', steer: 1, until: { kind: 'heading', deg: 1 } },
      { gear: 'D', steer: 0, until: { kind: 'inTarget' } },
    ],
  };
}

const fickaStor = ficka('ficka-stor', 4, 2.0, 'Fickparkering, stor lucka', 'Två billängder. Lär dig metoden.', 3, 30, 0.45);
const fickaTrang = ficka('ficka-trang', 5, 1.4, 'Fickparkering, trång lucka', '1,4 billängder. Som i Luthagen.', 4, 30, 0.45, 0.6);

// ---------- 6. Backa runt hörnet ----------
const CORNER_X = 10;
const FAR_X = 4;
const hornetCurbMain: Vec[] = [{ x: 36, y: 0 }, { x: CORNER_X + 2, y: 0 }, ...arcPoints({ x: CORNER_X + 2, y: -2 }, 2, rad(90), rad(180)).slice(1), { x: CORNER_X, y: -22 }];
const hornetCurbFar: Vec[] = [{ x: 0, y: 0 }, { x: FAR_X - 2, y: 0 }, ...arcPoints({ x: FAR_X - 2, y: -2 }, 2, rad(90), rad(0)).slice(1), { x: FAR_X, y: -22 }];
const hornet: Scenario = {
  id: 'hornet',
  order: 6,
  title: 'Backa runt hörnet',
  subtitle: 'Backning med sväng – ett klassiskt provmoment.',
  emoji: '↪️',
  intro:
    'Backa rakt längs kantstenen, sväng fullt till höger när bakaxeln är i höjd med svängpunkten, räta upp när bilen står vinkelrätt och backa vidare rakt. Håll 0,5–1 m från kantstenen hela vägen.',
  world: {
    w: 36,
    h: 34,
    sidewalks: [rect(0, 7, 36, 3), rect(CORNER_X, -22, 26, 22), rect(0, -22, FAR_X, 22)],
    buildings: [{ at: { x: 16, y: -14 }, w: 14, d: 8, h: 7 }, { at: { x: 6, y: 11 }, w: 20, d: 6, h: 5 }],
  },
  start: { x: 24, y: 1.665, heading: 0 },
  obstacles: [
    curb('kant', hornetCurbMain),
    curb('kant-bortre', hornetCurbFar),
    curb('kant-norr', [{ x: 0, y: 7 }, { x: 36, y: 7 }]),
    parkedCar('P1', 30, 7 - 1.165, 180, '#95a5a6'),
  ],
  markings: [{ kind: 'line', points: [{ x: 0, y: 3.5 }, { x: 36, y: 3.5 }], dashed: true }, { kind: 'line', points: [{ x: 7, y: -2 }, { x: 7, y: -22 }], dashed: true }],
  target: {
    pose: { x: 8.335, y: -10, heading: rad(90) },
    tolerance: { lon: 4, lat: [0.3, 0.6, 1.0], headingDeg: [5, 8, 12] },
    curb: { side: 'right', ideal: [0.4, 1.05], max: [1.05, 1.5, 2.0] },
  },
  rules: { maxSpeedKmh: 8, parMoves: 1, coachingAvailable: true, coneIsScratch: true },
  coach: 'hornet',
  coachParams: { turnX: 12.165, curbId: 'kant' },
  script: [
    { gear: 'R', steer: 0, until: { kind: 'x', le: 12.165 } },
    { gear: 'R', steer: -1, until: { kind: 'heading', deg: 90 } },
    { gear: 'R', steer: 0, until: { kind: 'inTarget' } },
  ],
};

// ---------- 7. Trepunktsvändning ----------
const STREET_W = 7.5;
const trepunkt: Scenario = {
  id: 'trepunkt',
  order: 7,
  title: 'Trepunktsvändning',
  subtitle: 'Vänd på en smal gata på tre drag.',
  emoji: '🔄',
  intro: 'Vänd bilen på gatan med så få drag som möjligt: fullt vänster framåt, fullt höger bakåt, fullt vänster framåt. Titta ordentligt åt båda håll före varje drag.',
  world: { w: 28, h: STREET_W + 6, sidewalks: [rect(0, -3, 28, 3), rect(0, STREET_W, 28, 3)], buildings: [{ at: { x: 4, y: -7 }, w: 8, d: 4, h: 5 }, { at: { x: 16, y: STREET_W + 3 }, w: 10, d: 4, h: 6 }] },
  start: { x: 8, y: 1.665, heading: 0 },
  obstacles: [curb('kant', [{ x: 0, y: 0 }, { x: 28, y: 0 }]), curb('kant-andra', [{ x: 0, y: STREET_W }, { x: 28, y: STREET_W }]), cone('lykta', 2, STREET_W + 0.6), cone('lykta2', 26, -0.6)],
  markings: [{ kind: 'line', points: [{ x: 0, y: STREET_W / 2 }, { x: 28, y: STREET_W / 2 }], dashed: true }],
  target: {
    pose: { x: 8, y: 5.0, heading: Math.PI },
    tolerance: { lon: 12, lat: [0.6, 1.0, 1.5], headingDeg: [6, 10, 15] },
  },
  rules: { maxSpeedKmh: 8, parMoves: 3, coachingAvailable: false, coneIsScratch: true, movesStars: [3, 5, 7] },
  coach: 'none',
  script: [
    { gear: 'D', steer: 1, until: { kind: 'cornerNear', corner: 'fl', obstacleId: 'kant-andra', within: 0.35 } },
    { gear: 'R', steer: -1, until: { kind: 'cornerNear', corner: 'rr', obstacleId: 'kant', within: 0.35 } },
    { gear: 'D', steer: 1, until: { kind: 'heading', deg: 180 } },
    { gear: 'D', steer: 0, until: { kind: 'inTarget' } },
  ],
};

// ---------- 8. Gamla Uppsala ----------
function oldLot(): { obstacles: Obstacle[]; markings: Marking[] } {
  const obstacles: Obstacle[] = [];
  const markings: Marking[] = [];
  const BAY_W = 2.4;
  for (let k = 0; k < 7; k++) {
    const x = 4 + BAY_W * k;
    markings.push(bayMarking(x, 0, BAY_W, 5));
    if (k === 3 || k === 5) obstacles.push(parkedCar(`volvo${k}`, x + BAY_W / 2, 2.5, 90, k === 3 ? '#1f3a5f' : '#7f8c8d', 'Volvo V70', 4.8, 1.86));
    if (k === 0 || k === 1 || k === 6) obstacles.push(parkedCar(`bil${k}`, x + BAY_W / 2, 2.5, 90, CAR_COLORS[(k + 2) % CAR_COLORS.length] as string));
  }
  obstacles.push(curb('kant-bak', [{ x: 0, y: 0 }, { x: 24, y: 0 }]));
  obstacles.push(curb('kant-fram', [{ x: 0, y: 11 }, { x: 24, y: 11 }]));
  obstacles.push({ id: 'kundvagn', kind: 'cart', pose: { x: 21.5, y: 5.4, heading: rad(20) } });
  return { obstacles, markings };
}
const gamlaUppsala: Scenario = {
  id: 'gamla-uppsala',
  order: 8,
  title: 'Gamla Uppsala-parkeringen',
  subtitle: 'Smala rutor, en Volvo på varje sida och en kundvagn.',
  emoji: '🏛️',
  intro: 'Backa in mellan de två Volvobilarna. Rutorna är gamla och smala, så det gäller att börja svängen på rätt ställe. Ingen hjälp här – som på provet.',
  world: { w: 24, h: 14 },
  start: { x: 18.63, y: 7.8, heading: 0 },
  ...oldLot(),
  target: {
    pose: axleFromCentre(4 + 2.4 * 4 + 1.2, 2.5, 90),
    tolerance: { lon: 0.35, lat: [0.12, 0.25, 0.4], headingDeg: [3, 6, 9] },
    bay: rect(4 + 2.4 * 4, 0, 2.4, 5),
  },
  rules: { maxSpeedKmh: 8, parMoves: 2, coachingAvailable: false, coneIsScratch: true },
  coach: 'none',
  script: [
    { gear: 'R', steer: -1, until: { kind: 'heading', deg: 90 } },
    { gear: 'R', steer: 0, until: { kind: 'inTarget' } },
  ],
};

export const SCENARIOS: Scenario[] = [sandlada, nosRuta, backRuta, fickaStor, fickaTrang, hornet, trepunkt, gamlaUppsala];

export function scenarioById(id: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export function nextScenario(id: string): Scenario | undefined {
  const s = scenarioById(id);
  if (!s) return undefined;
  return SCENARIOS.find((x) => x.order === s.order + 1);
}

export const MAX_STARS = SCENARIOS.length * 3;
