import type { Prompt, PromptOption, Question, Sign, SignCategory, StreakVariant } from '@/types';
import { SIGN_DURATION_MS, TEXT_DURATION_MS } from './scoring';
import { shuffle, type Rng } from './rng';

const ADJACENT: Partial<Record<SignCategory, SignCategory[]>> = {
  A: ['B', 'C'],
  B: ['A', 'C'],
  C: ['D', 'A'],
  D: ['C', 'E'],
  E: ['D', 'J'],
  F: ['G', 'H'],
  G: ['F', 'H'],
  H: ['G', 'I'],
  I: ['H', 'G'],
  J: ['E', 'X'],
  M: ['X', 'E'],
  P: ['S', 'X'],
  S: ['P', 'X'],
  T: ['X', 'E'],
  X: ['T', 'M'],
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

function namesOf(sign: Sign): string[] {
  return [sign.name, ...(sign.aliases ?? [])].map(normalize);
}

function conflicts(a: Sign, b: Sign): boolean {
  if (a.code === b.code) return true;
  const an = namesOf(a);
  const bn = namesOf(b);
  return an.some((n) => bn.includes(n));
}

export function signFile(sign: Sign, rng?: Rng): string {
  const files = sign.files;
  if (files.length === 0) throw new Error(`Sign ${sign.code} has no files`);
  if (!rng || files.length === 1) return files[0] as string;
  return files[Math.floor(rng() * files.length)] as string;
}

/** Chooses three distractor signs: same group first, then same category, then adjacent categories. */
export function pickSignDistractors(target: Sign, all: readonly Sign[], rng: Rng): Sign[] {
  const usable = all.filter((s) => s.quizzable && s.files.length > 0 && !conflicts(target, s));
  const chosen: Sign[] = [];
  const taken = (s: Sign) => chosen.some((c) => conflicts(c, s));

  const add = (pool: Sign[], max: number) => {
    for (const s of shuffle(pool, rng)) {
      if (chosen.length >= 3 || max <= 0) break;
      if (!taken(s)) {
        chosen.push(s);
        max--;
      }
    }
  };

  if (target.group) {
    add(usable.filter((s) => s.group === target.group), 2);
  }
  add(usable.filter((s) => s.category === target.category), 3);
  for (const cat of ADJACENT[target.category] ?? []) {
    if (chosen.length >= 3) break;
    add(usable.filter((s) => s.category === cat), 3);
  }
  if (chosen.length < 3) add(usable, 3);
  if (chosen.length < 3) throw new Error(`Not enough distractors for ${target.code}`);
  return chosen;
}

export function buildSignPrompt(
  target: Sign,
  all: readonly Sign[],
  variant: 'name2img' | 'img2name',
  rng: Rng,
  durationMs = SIGN_DURATION_MS,
): Prompt {
  const distractors = pickSignDistractors(target, all, rng);
  const entries = shuffle([target, ...distractors], rng);
  const correctIndex = entries.indexOf(target);
  const options: PromptOption[] = entries.map((s) =>
    variant === 'name2img' ? { label: s.name, image: signFile(s, rng) } : { label: s.name },
  );
  return {
    qid: `sign:${target.code}:${variant}`,
    kind: 'sign',
    variant,
    title: variant === 'name2img' ? target.name : 'Vad betyder märket?',
    image: variant === 'img2name' ? signFile(target, rng) : undefined,
    options,
    correctIndex,
    durationMs,
    explanation: target.explanation,
  };
}

export function buildTextPrompt(q: Question, rng: Rng, durationMs = TEXT_DURATION_MS, signs?: ReadonlyMap<string, Sign>): Prompt {
  const order = shuffle([0, 1, 2, 3], rng);
  const options: PromptOption[] = order.map((i) => ({ label: q.options[i] as string }));
  const correctIndex = order.indexOf(q.correct);
  const ref = q.signRefs?.[0];
  const image = ref && signs?.get(ref) ? signFile(signs.get(ref) as Sign) : undefined;
  return {
    qid: q.id,
    kind: 'text',
    variant: 'text',
    title: q.question,
    image,
    options,
    correctIndex,
    durationMs,
    explanation: q.explanation,
  };
}

export function variantFor(mode: StreakVariant | 'mixed', rng: Rng): 'name2img' | 'img2name' {
  if (mode === 'img2name') return 'img2name';
  if (mode === 'name2img') return 'name2img';
  return rng() < 0.5 ? 'name2img' : 'img2name';
}
