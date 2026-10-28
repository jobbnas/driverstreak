import { describe, expect, it } from 'vitest';
import { SCENARIOS, scenarioById } from '@/engine/parking/scenarios';
import { runScript } from '@/engine/parking/script';
import { collide } from '@/engine/parking/collision';
import { DEFAULT_CAR } from '@/engine/parking/car';

describe('scenarios', () => {
  it('have unique ids and orders', () => {
    const ids = new Set(SCENARIOS.map((s) => s.id));
    expect(ids.size).toBe(SCENARIOS.length);
    expect(SCENARIOS.map((s) => s.order)).toEqual(SCENARIOS.map((_, i) => i + 1));
  });
  it('start and target poses are collision free', () => {
    for (const s of SCENARIOS) {
      expect(collide(s.start, DEFAULT_CAR, s.obstacles, 0), s.id).toEqual([]);
      if (s.target) expect(collide(s.target.pose, DEFAULT_CAR, s.obstacles, 0), `${s.id} target`).toEqual([]);
    }
  });
  for (const s of SCENARIOS.filter((x) => x.script.length > 0)) {
    it(`${s.id}: the ideal script scores three stars`, () => {
      const r = runScript(s);
      const e = r.final.state;
      const info = `${s.id}: pose=(${e.pose.x.toFixed(2)}, ${e.pose.y.toFixed(2)}, ${((e.pose.heading * 180) / Math.PI).toFixed(1)}°) moves=${e.moves} collisions=${e.collisions.map((c) => c.obstacleId).join(',')} inTarget=${e.inTarget} warnings=${r.warnings.join('|')}`;
      expect(e.collisions, info).toEqual([]);
      expect(e.moves, info).toBeLessThanOrEqual(s.rules.parMoves);
      expect(r.stars, info).toBe(3);
      expect(r.warnings, info).toEqual([]);
    });
  }
});

describe('coach cues on the ideal path', () => {
  it('fickparkering emits the cues in order', () => {
    const r = runScript(scenarioById('ficka-stor')!);
    expect(r.cues).toEqual(['approach', 'straightBack', 'fullRight', 'straighten', 'fullLeft', 'straightenStop', 'done']);
  });
  it('backa runt hörnet emits the cues in order', () => {
    const r = runScript(scenarioById('hornet')!);
    expect(r.cues).toEqual(['straight', 'turnIn', 'straighten', 'straightOut', 'done']);
  });
  it('ruta emits the cues in order', () => {
    expect(runScript(scenarioById('back-ruta')!).cues).toEqual(['approach', 'fullRight', 'straighten', 'done']);
    expect(runScript(scenarioById('nos-ruta')!).cues).toEqual(['approach', 'fullRight', 'straighten', 'done']);
  });
});
