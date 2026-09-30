import { describe, expect, it } from 'vitest';
import { mulberry32 } from '@/engine/rng';
import { buildSignPrompt, buildTextPrompt, pickSignDistractors } from '@/engine/distractors';
import type { Question, Sign } from '@/types';

const signs: Sign[] = [
  { code: 'A1', name: 'Varning för farlig kurva', category: 'A', explanation: 'x', files: ['A1-1.svg', 'A1-2.svg'], group: 'kurva', quizzable: true },
  { code: 'A2', name: 'Varning för flera farliga kurvor', category: 'A', explanation: 'x', files: ['A2-1.svg'], group: 'kurva', quizzable: true },
  { code: 'A3', name: 'Varning för nedförslutning', category: 'A', explanation: 'x', files: ['A3.svg'], quizzable: true },
  { code: 'A4', name: 'Varning för stigning', category: 'A', explanation: 'x', files: ['A4.svg'], quizzable: true },
  { code: 'A5', name: 'Varning för avsmalnande väg', category: 'A', explanation: 'x', files: ['A5-1.svg'], quizzable: true },
  { code: 'A99', name: 'Varning för farlig kurva', category: 'A', explanation: 'dup name', files: ['A99.svg'], quizzable: true },
  { code: 'B1', name: 'Väjningsplikt', category: 'B', explanation: 'x', files: ['B1.svg'], quizzable: true },
  { code: 'B2', name: 'Stopplikt', category: 'B', explanation: 'x', files: ['B2.svg'], quizzable: true },
  { code: 'C1', name: 'Förbud mot infart', category: 'C', explanation: 'x', files: ['C1.svg'], quizzable: true },
  { code: 'C2', name: 'Förbud mot trafik med fordon', category: 'C', explanation: 'x', files: ['C2.svg'], quizzable: false },
];

describe('pickSignDistractors', () => {
  it('returns 3 unique signs, preferring same group and category', () => {
    const rng = mulberry32(5);
    const target = signs[0]!;
    for (let i = 0; i < 50; i++) {
      const d = pickSignDistractors(target, signs, rng);
      expect(d).toHaveLength(3);
      expect(new Set(d.map((s) => s.code)).size).toBe(3);
      expect(d.map((s) => s.code)).not.toContain('A1');
      expect(d.map((s) => s.name)).not.toContain(target.name); // A99 excluded
      expect(d.some((s) => s.code === 'A2')).toBe(true); // same group always included
      for (const s of d) expect(s.category).toBe('A');
    }
  });
  it('falls back to adjacent categories for small categories', () => {
    const rng = mulberry32(9);
    const d = pickSignDistractors(signs[6]!, signs, rng);
    expect(d).toHaveLength(3);
    expect(d.map((s) => s.code)).toContain('B2');
    expect(d.map((s) => s.code)).not.toContain('C2'); // not quizzable
  });
});

describe('buildSignPrompt', () => {
  it('builds name2img with images and correct index', () => {
    const rng = mulberry32(11);
    const p = buildSignPrompt(signs[0]!, signs, 'name2img', rng);
    expect(p.options).toHaveLength(4);
    expect(p.title).toBe('Varning för farlig kurva');
    expect(p.options[p.correctIndex]!.label).toBe('Varning för farlig kurva');
    expect(p.options.every((o) => !!o.image)).toBe(true);
    expect(new Set(p.options.map((o) => o.image)).size).toBe(4);
    expect(p.durationMs).toBe(9000);
  });
  it('builds img2name with a prompt image and text options', () => {
    const rng = mulberry32(12);
    const p = buildSignPrompt(signs[0]!, signs, 'img2name', rng);
    expect(p.image).toMatch(/^A1-/);
    expect(p.options.every((o) => !o.image)).toBe(true);
    expect(p.options[p.correctIndex]!.label).toBe('Varning för farlig kurva');
  });
});

describe('buildTextPrompt', () => {
  const q: Question = {
    id: 'tr-vaj-001',
    category: 'trafikregler',
    subtopic: 'vajningsregler',
    difficulty: 1,
    question: 'Vad gäller?',
    options: ['A', 'B', 'C', 'D'],
    correct: 2,
    explanation: 'Because of reasons that are long enough.',
  };
  it('shuffles options and tracks the correct index', () => {
    for (let seed = 0; seed < 20; seed++) {
      const p = buildTextPrompt(q, mulberry32(seed));
      expect(p.options.map((o) => o.label).sort()).toEqual(['A', 'B', 'C', 'D']);
      expect(p.options[p.correctIndex]!.label).toBe('C');
      expect(p.durationMs).toBe(20000);
    }
  });
});
