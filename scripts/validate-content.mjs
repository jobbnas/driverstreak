#!/usr/bin/env node
// Validates content/questions/*.json against the schema, subtopic enum and sign manifest.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const qDir = join(root, 'content', 'questions');
const subtopics = JSON.parse(readFileSync(join(root, 'content', 'subtopics.json'), 'utf8'));
const signsPath = join(root, 'content', 'signs', 'signs.json');
const signs = existsSync(signsPath) ? JSON.parse(readFileSync(signsPath, 'utf8')) : [];
const signCodes = new Set(signs.map((s) => s.code));

const PREFIX = { trafikregler: 'tr', trafiksakerhet: 'ts', fordon: 'fo', miljo: 'mi', personliga: 'pe', vagmarken: 'vm' };
const ALLOWED = new Set(['id', 'category', 'subtopic', 'difficulty', 'question', 'options', 'correct', 'explanation', 'signRefs', 'legalRef', 'reviewed']);
const norm = (s) => String(s).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

export function validate({ files, signCodes: codes = signCodes, subtopics: subs = subtopics }) {
  const errors = [];
  const warnings = [];
  const ids = new Map();
  const texts = new Map();
  const counts = {};
  let total = 0;
  for (const [file, data] of files) {
    if (!Array.isArray(data)) {
      errors.push(`${file}: root must be an array`);
      continue;
    }
    const positions = [0, 0, 0, 0];
    for (const [i, q] of data.entries()) {
      const where = `${file}#${i} (${q?.id ?? '?'})`;
      if (!q || typeof q !== 'object') {
        errors.push(`${where}: not an object`);
        continue;
      }
      total++;
      for (const k of Object.keys(q)) if (!ALLOWED.has(k)) errors.push(`${where}: unknown field "${k}"`);
      for (const k of ['id', 'category', 'subtopic', 'difficulty', 'question', 'options', 'correct', 'explanation'])
        if (!(k in q)) errors.push(`${where}: missing "${k}"`);
      if (!(q.category in PREFIX)) errors.push(`${where}: bad category "${q.category}"`);
      else {
        if (!subs[q.category]?.[q.subtopic]) errors.push(`${where}: unknown subtopic "${q.subtopic}" for ${q.category}`);
        const key = `${q.category}/${q.subtopic}`;
        counts[key] = (counts[key] ?? 0) + 1;
        if (typeof q.id !== 'string' || !/^[a-z]{2}-[a-z0-9]+-\d{3}$/.test(q.id)) errors.push(`${where}: id must match xx-sub-000`);
        else if (!q.id.startsWith(PREFIX[q.category] + '-')) errors.push(`${where}: id prefix does not match category`);
      }
      if (ids.has(q.id)) errors.push(`${where}: duplicate id (also in ${ids.get(q.id)})`);
      else ids.set(q.id, file);
      if (![1, 2, 3].includes(q.difficulty)) errors.push(`${where}: difficulty must be 1|2|3`);
      if (typeof q.question !== 'string' || q.question.trim().length < 10) errors.push(`${where}: question too short`);
      else {
        const t = norm(q.question);
        if (texts.has(t)) errors.push(`${where}: duplicate question text (also ${texts.get(t)})`);
        else texts.set(t, q.id);
        if (q.question.length > 260) warnings.push(`${where}: question longer than 260 chars`);
      }
      if (!Array.isArray(q.options) || q.options.length !== 4) errors.push(`${where}: exactly 4 options required`);
      else {
        const seen = new Set();
        for (const o of q.options) {
          if (typeof o !== 'string' || !o.trim()) errors.push(`${where}: empty option`);
          else {
            const n = norm(o);
            if (seen.has(n)) errors.push(`${where}: duplicate option "${o}"`);
            seen.add(n);
            if (o.length > 110) warnings.push(`${where}: option longer than 110 chars`);
            if (/^(alla|inget|ingen|samtliga) (ovanstående|av ovanstående|alternativ)/i.test(o)) errors.push(`${where}: "alla/inget ovanstående" is not allowed`);
          }
        }
      }
      if (![0, 1, 2, 3].includes(q.correct)) errors.push(`${where}: correct must be 0..3`);
      else positions[q.correct]++;
      if (typeof q.explanation !== 'string' || q.explanation.trim().length < 20) errors.push(`${where}: explanation too short (min 20 chars)`);
      if (q.signRefs !== undefined) {
        if (!Array.isArray(q.signRefs)) errors.push(`${where}: signRefs must be an array`);
        else for (const c of q.signRefs) if (!codes.has(c)) errors.push(`${where}: unknown signRef "${c}"`);
      }
      if (q.legalRef !== undefined && typeof q.legalRef !== 'string') errors.push(`${where}: legalRef must be a string`);
      if (q.reviewed !== undefined && typeof q.reviewed !== 'boolean') errors.push(`${where}: reviewed must be boolean`);
    }
    const n = data.length || 1;
    positions.forEach((p, idx) => {
      if (n >= 20 && p / n > 0.35) warnings.push(`${file}: correct answer at position ${idx} in ${Math.round((p / n) * 100)}% of questions`);
    });
  }
  const coverage = [];
  for (const [cat, subs2] of Object.entries(subs)) {
    for (const [sub, meta] of Object.entries(subs2)) {
      const have = counts[`${cat}/${sub}`] ?? 0;
      coverage.push({ category: cat, subtopic: sub, have, target: meta.target });
    }
  }
  return { errors, warnings, total, coverage };
}

function loadFiles() {
  if (!existsSync(qDir)) return [];
  return readdirSync(qDir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => {
      try {
        return [f, JSON.parse(readFileSync(join(qDir, f), 'utf8'))];
      } catch (e) {
        return [f, { __parseError: String(e) }];
      }
    });
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const files = loadFiles();
  const parseErrors = files.filter(([, d]) => d && d.__parseError).map(([f, d]) => `${f}: ${d.__parseError}`);
  const { errors, warnings, total, coverage } = validate({ files: files.filter(([, d]) => !d?.__parseError) });
  const all = [...parseErrors, ...errors];
  const showCoverage = process.argv.includes('--coverage') || process.argv.includes('-c');
  if (showCoverage) {
    let cur = '';
    for (const row of coverage) {
      if (row.category !== cur) {
        cur = row.category;
        console.log(`\n${cur}`);
      }
      const flag = row.have >= row.target ? 'ok ' : row.have === 0 ? '-- ' : '.. ';
      console.log(`  ${flag}${row.subtopic.padEnd(24)} ${String(row.have).padStart(4)} / ${row.target}`);
    }
    console.log();
  }
  for (const w of warnings) console.log(`warn: ${w}`);
  for (const e of all) console.log(`error: ${e}`);
  const missing = signs.filter((s) => s.quizzable && !s.files.every((f) => existsSync(join(root, 'public', 'signs', f))));
  if (missing.length) console.log(`warn: ${missing.length} quizzable signs lack files: ${missing.slice(0, 10).map((s) => s.code).join(', ')}${missing.length > 10 ? '…' : ''}`);
  console.log(`${total} questions in ${files.length} files, ${all.length} errors, ${warnings.length} warnings`);
  process.exit(all.length ? 1 : 0);
}
