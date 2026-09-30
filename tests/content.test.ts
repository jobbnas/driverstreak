import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { validate } from '../scripts/validate-content.mjs';

const root = join(__dirname, '..');
const qDir = join(root, 'content', 'questions');

describe('content', () => {
  it('question files pass the validator', () => {
    const files = existsSync(qDir)
      ? readdirSync(qDir).filter((f) => f.endsWith('.json')).map((f) => [f, JSON.parse(readFileSync(join(qDir, f), 'utf8'))] as [string, unknown])
      : [];
    const { errors } = validate({ files });
    expect(errors).toEqual([]);
  });
  it('every quizzable sign has its files on disk and unique names within category', () => {
    const signs = JSON.parse(readFileSync(join(root, 'content', 'signs', 'signs.json'), 'utf8')) as { code: string; name: string; category: string; files: string[]; quizzable: boolean }[];
    const missing = signs.filter((s) => s.quizzable && !s.files.every((f) => existsSync(join(root, 'public', 'signs', f))));
    expect(missing.map((s) => s.code)).toEqual([]);
    const codes = new Set<string>();
    for (const s of signs) {
      expect(codes.has(s.code), `duplicate code ${s.code}`).toBe(false);
      codes.add(s.code);
    }
  });
});
