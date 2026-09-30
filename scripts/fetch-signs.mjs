#!/usr/bin/env node
// Downloads Swedish road-sign SVGs from Wikimedia Commons according to
// content/signs/signs.json and writes them to public/signs/.
//
// Usage: node scripts/fetch-signs.mjs [--force]
// Exit code 1 if any quizzable sign is missing a file, else 0.
// Node >= 22, ESM, no dependencies.

import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const MANIFEST = path.join(ROOT, 'content/signs/signs.json');
const REPORT = path.join(ROOT, 'content/signs/fetch-report.json');
const OUT_DIR = path.join(ROOT, 'public/signs');
const ATTRIBUTION = path.join(OUT_DIR, 'ATTRIBUTION.md');
// file -> Commons title index, kept across runs so skipped files stay attributed
const ATTRIBUTION_INDEX = path.join(ROOT, 'content/signs/attribution-index.json');

const USER_AGENT =
  'DriverStreak/0.1 (https://github.com/jobbnas/driverstreak; educational road-sign quiz)';
const CONCURRENCY = 4;
const FORCE = process.argv.includes('--force');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/** Candidate Commons titles (without "File:") for a given file stem. */
function candidateTitles(stem, override) {
  const list = [];
  if (override) list.push(override);
  list.push(
    `Sweden road sign ${stem}.svg`,
    `Sweden road sign ${stem.replace('-', ' ')}.svg`,
    `Sweden_road_sign_${stem}.svg`,
    `SE road sign ${stem}.svg`,
    `Swedish road sign ${stem}.svg`,
  );
  return [...new Set(list)];
}

function filePathUrl(title) {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(title)}`;
}

// Global politeness: when Commons answers 429 we slow everything down.
let globalDelayMs = 0;

/**
 * Fetch one Commons title. Returns { ok: true, body } or { ok: false, status }.
 * Retries once on 429/5xx with 2–4 s backoff.
 */
async function fetchTitle(title) {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (globalDelayMs) await sleep(globalDelayMs);
    let res;
    try {
      res = await fetch(filePathUrl(title), {
        redirect: 'follow',
        headers: { 'User-Agent': USER_AGENT, Accept: 'image/svg+xml,*/*' },
      });
    } catch (err) {
      if (attempt === 0) {
        await sleep(2000 + Math.random() * 2000);
        continue;
      }
      return { ok: false, status: `network: ${err.message}` };
    }
    if (res.ok) {
      const body = await res.text();
      return { ok: true, body, url: res.url };
    }
    if (res.status === 429 || res.status >= 500) {
      if (res.status === 429) globalDelayMs = Math.min(globalDelayMs + 1000, 5000);
      if (attempt === 0) {
        await sleep(2000 + Math.random() * 2000);
        continue;
      }
    }
    return { ok: false, status: res.status };
  }
  return { ok: false, status: 'retry-exhausted' };
}

/** Clean an SVG body: strip prolog/doctype/comments/metadata, ensure viewBox. */
function cleanSvg(body) {
  let s = body;
  s = s.replace(/^﻿/, '');
  s = s.replace(/<\?xml[^>]*\?>\s*/gi, '');
  // Illustrator exports declare entities in the DOCTYPE internal subset
  // (e.g. <!ENTITY ns_svg "http://www.w3.org/2000/svg">) and reference them
  // as &ns_svg; in the markup. Expand them before the DOCTYPE is removed.
  const subset = s.match(/<!DOCTYPE[^>[]*\[([\s\S]*?)\]\s*>/i)?.[1];
  if (subset) {
    const entities = new Map();
    for (const m of subset.matchAll(/<!ENTITY\s+([A-Za-z_][\w.-]*)\s+(?:"([^"]*)"|'([^']*)')\s*>/g)) {
      entities.set(m[1], m[2] ?? m[3] ?? '');
    }
    if (entities.size) {
      s = s.replace(/&([A-Za-z_][\w.-]*);/g, (whole, name) =>
        entities.has(name) ? entities.get(name) : whole,
      );
    }
  }
  s = s.replace(/<!DOCTYPE[^>[]*(\[[^\]]*\])?[^>]*>\s*/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  s = s.replace(/<metadata\b[\s\S]*?<\/metadata>/gi, '');
  s = s.trim();

  const rootMatch = s.match(/<svg\b[^>]*>/i);
  if (!rootMatch) return null;
  let root = rootMatch[0];
  if (!/\sviewBox\s*=/i.test(root)) {
    const w = root.match(/\swidth\s*=\s*"([^"]+)"/i)?.[1];
    const h = root.match(/\sheight\s*=\s*"([^"]+)"/i)?.[1];
    const num = (v) => (v == null ? NaN : parseFloat(String(v).replace(/[a-z%]+$/i, '')));
    const wn = num(w);
    const hn = num(h);
    if (Number.isFinite(wn) && Number.isFinite(hn) && wn > 0 && hn > 0) {
      const newRoot = root.replace(/<svg\b/i, `<svg viewBox="0 0 ${wn} ${hn}"`);
      s = s.replace(root, newRoot);
    }
  }
  return s;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const signs = JSON.parse(await readFile(MANIFEST, 'utf8'));
await mkdir(OUT_DIR, { recursive: true });

// Build the job list: one job per (sign, file).
const jobs = [];
for (const sign of signs) {
  sign.files.forEach((file, i) => {
    const stem = file.replace(/\.svg$/i, '');
    jobs.push({
      code: sign.code,
      quizzable: sign.quizzable,
      file,
      candidates: candidateTitles(stem, sign.commons?.[i]),
    });
  });
}

// Deduplicate by file name (several signs may share a file).
const seen = new Set();
const uniqueJobs = jobs.filter((j) => {
  if (seen.has(j.file)) return false;
  seen.add(j.file);
  return true;
});

const found = [];
const missing = [];
const skipped = [];

async function runJob(job) {
  const dest = path.join(OUT_DIR, job.file);
  if (!FORCE && (await exists(dest))) {
    skipped.push({ code: job.code, file: job.file });
    return;
  }
  const tried = [];
  for (const title of job.candidates) {
    tried.push(title);
    const res = await fetchTitle(title);
    if (!res.ok) continue;
    if (!/<svg[\s>]/i.test(res.body)) continue; // not an SVG (HTML error page etc.)
    const cleaned = cleanSvg(res.body);
    if (!cleaned) continue;
    await writeFile(dest, cleaned, 'utf8');
    found.push({ code: job.code, file: job.file, title, bytes: cleaned.length });
    console.log(`ok       ${job.file}  <-  ${title}`);
    return;
  }
  missing.push({ code: job.code, file: job.file, quizzable: job.quizzable, tried });
  console.log(`MISSING  ${job.file}  (${job.code}) tried ${tried.length} titles`);
}

// Simple worker pool with fixed concurrency.
let cursor = 0;
async function worker() {
  while (cursor < uniqueJobs.length) {
    const job = uniqueJobs[cursor++];
    await runJob(job);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

found.sort((a, b) => a.file.localeCompare(b.file));
missing.sort((a, b) => a.file.localeCompare(b.file));
skipped.sort((a, b) => a.file.localeCompare(b.file));

const report = {
  generatedAt: new Date().toISOString(),
  found: found.map(({ code, file, title }) => ({ code, file, title })),
  missing: missing.map(({ code, file, tried }) => ({ code, file, tried })),
  skipped,
};
await writeFile(REPORT, JSON.stringify(report, null, 2) + '\n', 'utf8');

// Attribution: merge titles from this run with titles from a previous report
// so skipped files keep their attribution.
const titlesByFile = new Map();
for (const f of found) titlesByFile.set(f.file, f.title);
try {
  const prev = JSON.parse(await readFile(ATTRIBUTION_INDEX, 'utf8'));
  for (const [file, title] of Object.entries(prev)) {
    if (!titlesByFile.has(file) && (await exists(path.join(OUT_DIR, file)))) {
      titlesByFile.set(file, title);
    }
  }
} catch {
  /* no previous attribution index */
}
await writeFile(
  ATTRIBUTION_INDEX,
  JSON.stringify(Object.fromEntries([...titlesByFile.entries()].sort()), null, 2) + '\n',
  'utf8',
);

const attributionLines = [
  '# Attribution',
  '',
  'The SVG files in this directory are diagrams of Swedish road signs, road markings and',
  'traffic devices as defined in Vägmärkesförordningen (SFS 2007:90). The designs are',
  'published by Transportstyrelsen (the Swedish Transport Agency) and are in the public',
  'domain (see the `PD-Transportstyrelsen` licence tag on Wikimedia Commons).',
  '',
  'The files were downloaded from Wikimedia Commons with `scripts/fetch-signs.mjs`.',
  'XML prolog, DOCTYPE, comments and `<metadata>` were stripped; otherwise the files are',
  'unmodified.',
  '',
  '| Local file | Wikimedia Commons source |',
  '|---|---|',
  ...[...titlesByFile.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([file, title]) =>
        `| ${file} | [${title}](https://commons.wikimedia.org/wiki/File:${encodeURIComponent(
          title.replace(/ /g, '_'),
        )}) |`,
    ),
  '',
];
await writeFile(ATTRIBUTION, attributionLines.join('\n'), 'utf8');

// ---------------------------------------------------------------------------
// Summary + exit code
// ---------------------------------------------------------------------------

console.log('');
console.log(`Downloaded: ${found.length}   Skipped (already present): ${skipped.length}   Missing: ${missing.length}`);

const missingQuizzable = missing.filter((m) => m.quizzable);
if (missingQuizzable.length) {
  console.error('');
  console.error(`ERROR: ${missingQuizzable.length} quizzable sign file(s) could not be downloaded:`);
  for (const m of missingQuizzable) {
    console.error(`  ${m.code}  ${m.file}`);
    for (const t of m.tried) console.error(`      tried: ${t}`);
  }
  process.exit(1);
}
process.exit(0);
