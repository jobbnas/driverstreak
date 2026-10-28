import { describe, expect, it } from 'vitest';
import { senseSides } from '@/engine/parking/sensors';
import { DEFAULT_CAR } from '@/engine/parking/car';
import type { Obstacle } from '@/engine/parking/types';

describe('sensors', () => {
  const spec = DEFAULT_CAR;
  it('measures a wall ahead and a car to the right', () => {
    const frontX = spec.wheelbase + spec.frontOverhang;
    const wall: Obstacle = { id: 'w', kind: 'wall', a: { x: frontX + 1, y: -5 }, b: { x: frontX + 1, y: 5 } };
    const car: Obstacle = { id: 'c', kind: 'car', pose: { x: 0, y: -(spec.width / 2 + 0.5 + 0.915), heading: 0 }, length: 4.7, width: 1.83, color: '#000' };
    const s = senseSides({ x: 0, y: 0, heading: 0 }, spec, [wall, car]);
    expect(s.front.d).toBeCloseTo(1, 6);
    expect(s.right.d).toBeCloseTo(0.5, 6);
    expect(s.left.d).toBeCloseTo(1, 6); // the wall spans past the front-left corner
    expect(s.rear.d).toBeCloseTo(0.5, 6); // the parked car's flank also lies behind the rear corner
    expect(s.right.obstacleId).toBe('c');
  });
  it('attributes correctly when the car is rotated and caps at range', () => {
    const wall: Obstacle = { id: 'w', kind: 'wall', a: { x: -5, y: 0.915 + 0.8 }, b: { x: 5, y: 0.915 + 0.8 } };
    const s = senseSides({ x: 0, y: 0, heading: 0 }, spec, [wall]);
    expect(s.left.d).toBeCloseTo(0.8, 6);
    const far: Obstacle = { id: 'f', kind: 'wall', a: { x: -5, y: 10 }, b: { x: 5, y: 10 } };
    expect(senseSides({ x: 0, y: 0, heading: 0 }, spec, [far]).left.d).toBe(Infinity);
    // rotated 90deg: the wall at +y is now in front
    const s2 = senseSides({ x: 0, y: -2, heading: Math.PI / 2 }, spec, [wall]);
    expect(s2.front.d).toBeCloseTo(0.915 + 0.8 + 2 - (spec.wheelbase + spec.frontOverhang), 6);
  });
});
