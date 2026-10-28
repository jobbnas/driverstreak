import type { Hit, Scenario, ScenarioId, Stars } from './types';
import { mulberry32 } from '../rng';
import type { Outcome } from './scoring';

export const COST = { scratch: 3500, bumper: 9000 } as const;

export function hitCost(h: Hit, scenario: Scenario): number {
  if (h.kind === 'cone' && !scenario.rules.coneIsScratch) return 0;
  return h.severity === 'bumper' ? COST.bumper : COST.scratch;
}

export function damageOf(hits: Hit[], scenario: Scenario): number {
  return hits.reduce((sum, h) => sum + hitCost(h, scenario), 0);
}

const REMARKS: Record<string, string[]> = {
  three: ['Snyggt. Det där hade gått på provet.', 'Rakt, nära och utan en skråma. Mer så.', 'Inget att anmärka på. Lennart hade nickat.'],
  two: ['Godkänt. Lite finlir kvar.', 'Bra. Ett drag mindre nästa gång.', 'Den sitter. Nästan mitt i.'],
  one: ['Det blev en parkering. Tekniskt sett.', 'Innanför linjerna, med marginal åt fel håll.', 'Okej. Ta det en gång till med lugnare ratt.'],
  farCurb: ['Det får plats en cykel mellan dig och kantstenen.', 'Lite långt ut. Sikta på två decimeter.'],
  crooked: ['Lite snett, men innanför.', 'Bilen står som en kommentar. Räta upp nästa gång.'],
  manyMoves: ['Några drag extra. Lugnt, det räknas ändå.', 'Flera försök, men det blev bra till slut.'],
  collisions: ['Plåten minns. Sakta ner när det blir trångt.', 'En kontakt för mycket. Lita på speglarna.'],
  failed: ['Tre kontakter – vi avbryter här och tar det igen.', 'Det blev för många smällar. Nytt försök.'],
  sandbox: ['Fin runda i sandlådan.', 'Konerna står kvar. Nästan alla.'],
};

export function remark(outcome: Outcome, starsGot: Stars, scenario: Scenario, seed: number): string {
  const rng = mulberry32(seed);
  const pick = (k: string) => {
    const arr = REMARKS[k] as string[];
    return arr[Math.floor(rng() * arr.length)] as string;
  };
  if (outcome.failed) return pick('failed');
  if (scenario.rules.coneStars) return pick('sandbox');
  if (outcome.collisions > 0 && starsGot < 3) return pick('collisions');
  if (outcome.pose && outcome.pose.curbDist !== undefined && outcome.pose.curbDist > 0.6) return pick('farCurb');
  if (outcome.pose && Math.abs(outcome.pose.headingDeg) > 6) return pick('crooked');
  if (scenario.rules.parMoves > 0 && outcome.moves > scenario.rules.parMoves + 2) return pick('manyMoves');
  return pick(starsGot === 3 ? 'three' : starsGot === 2 ? 'two' : 'one');
}

export interface BadgeDef {
  id: string;
  title: string;
  description: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'kantstensmastare', title: 'Kantstensmästare', description: 'Tre fickparkeringar med 10–30 cm till kantstenen.' },
  { id: 'runt-hornet', title: 'Runt hörnet', description: 'Tre stjärnor på Backa runt hörnet.' },
  { id: 'trepunktaren', title: 'Trepunktaren', description: 'Vänd på exakt tre drag.' },
  { id: 'utan-hjalp', title: 'Utan hjälp', description: 'Tre stjärnor på en fickparkering med coachen av.' },
  { id: 'gamla-uppsala', title: 'Gamla Uppsala-diplom', description: 'Tre stjärnor mellan Volvobilarna.' },
  { id: 'platslagarens-favorit', title: 'Plåtslagarens favorit', description: '50 000 kr i skador. Han tackar.' },
];

export interface BadgeContext {
  scenarioId: ScenarioId;
  stars: Stars;
  outcome: Outcome;
  coaching: boolean;
  curbStreak: number;
  damageTotal: number;
}

export function badgesEarned(ctx: BadgeContext, have: readonly string[]): string[] {
  const out: string[] = [];
  const add = (id: string) => {
    if (!have.includes(id) && !out.includes(id)) out.push(id);
  };
  if (ctx.curbStreak >= 3) add('kantstensmastare');
  if (ctx.scenarioId === 'hornet' && ctx.stars === 3) add('runt-hornet');
  if (ctx.scenarioId === 'trepunkt' && ctx.stars >= 1 && ctx.outcome.moves <= 3) add('trepunktaren');
  if ((ctx.scenarioId === 'ficka-stor' || ctx.scenarioId === 'ficka-trang') && ctx.stars === 3 && !ctx.coaching) add('utan-hjalp');
  if (ctx.scenarioId === 'gamla-uppsala' && ctx.stars === 3) add('gamla-uppsala');
  if (ctx.damageTotal >= 50000) add('platslagarens-favorit');
  return out;
}
