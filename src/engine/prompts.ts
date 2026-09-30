import type { Category, Prompt, Question, Sign, StreakCategory, StreakVariant } from '@/types';
import { CATEGORIES } from '@/types';
import { buildSignPrompt, buildTextPrompt, variantFor } from './distractors';
import { nextMixedCategory, pickNext } from './selector';
import { mulberry32, randomSeed, type Rng } from './rng';
import { SIGN_DURATION_MS, TEXT_DURATION_MS } from './scoring';

export interface PromptSourceConfig {
  category: StreakCategory;
  variant: StreakVariant | 'mixed';
  signs: readonly Sign[];
  questions: readonly Question[];
  recent?: readonly string[];
  textDurationMs?: number;
  seed?: number;
}

/**
 * Produces prompts for a streak run. Signs are quizzed via synthetic prompts,
 * text categories via authored questions. Keeps its own anti-repeat memory.
 */
export class PromptSource {
  private readonly rng: Rng;
  private readonly askedSigns = new Set<string>();
  private readonly askedQuestions = new Set<string>();
  private readonly history: Category[] = [];
  private readonly signMap: ReadonlyMap<string, Sign>;
  private position = 0;

  constructor(private readonly cfg: PromptSourceConfig) {
    this.rng = mulberry32(cfg.seed ?? randomSeed());
    this.signMap = new Map(cfg.signs.map((s) => [s.code, s]));
  }

  /** Categories that currently have content. */
  availableCategories(): Category[] {
    return CATEGORIES.filter((c) =>
      c === 'vagmarken' ? this.cfg.signs.length >= 4 || this.hasQuestions(c) : this.hasQuestions(c),
    );
  }

  private hasQuestions(c: Category): boolean {
    return this.cfg.questions.some((q) => q.category === c && !this.askedQuestions.has(q.id));
  }

  next(): Prompt | undefined {
    const category = this.pickCategory();
    if (!category) return undefined;
    const prompt = category === 'vagmarken' ? this.nextSignOrSignQuestion() : this.nextText(category);
    if (prompt) {
      this.history.push(category);
      this.position++;
    }
    return prompt;
  }

  private pickCategory(): Category | undefined {
    if (this.cfg.category !== 'blandat') return this.cfg.category;
    const avail = this.availableCategories();
    if (avail.length === 0) return undefined;
    return nextMixedCategory(this.history, this.rng, avail);
  }

  private nextSignOrSignQuestion(): Prompt | undefined {
    const signPool = this.cfg.signs.filter((s) => !this.askedSigns.has(s.code));
    const textAvailable = this.hasQuestions('vagmarken');
    // In sign mode prefer image prompts; mix in authored sign questions ~20% of the time when available.
    const useText = textAvailable && (signPool.length === 0 || (this.cfg.variant === 'mixed' && this.rng() < 0.2));
    if (useText) return this.nextText('vagmarken');
    if (signPool.length === 0) return undefined;
    const recent = new Set((this.cfg.recent ?? []).map((id) => id.split(':')[1] ?? ''));
    const target = pickNext({
      pool: signPool.map((s) => ({ id: s.code, difficulty: undefined, sign: s })),
      asked: [],
      recent,
      rng: this.rng,
      position: this.position,
    });
    if (!target) return undefined;
    this.askedSigns.add(target.id);
    const variant = variantFor(this.cfg.variant, this.rng);
    return buildSignPrompt(target.sign, this.cfg.signs, variant, this.rng, SIGN_DURATION_MS);
  }

  private nextText(category: Category): Prompt | undefined {
    const pool = this.cfg.questions.filter((q) => q.category === category);
    const q = pickNext({ pool, asked: this.askedQuestions, recent: this.cfg.recent, rng: this.rng, position: this.position });
    if (!q) return undefined;
    this.askedQuestions.add(q.id);
    return buildTextPrompt(q, this.rng, this.cfg.textDurationMs ?? TEXT_DURATION_MS, this.signMap);
  }
}
