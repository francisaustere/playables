#!/usr/bin/env node
// Assembles the Playables Builder prompts into dist/planA and dist/planB,
// merges game_spec files into dist/game_spec, and fails if any prompt exceeds config.charLimit.
// Usage: node scripts/build.mjs [--report]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const config = JSON.parse(read('config.json'));
const errors = [];
const warnings = [];
const rows = [];

function read(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function exists(rel) { return fs.existsSync(path.join(ROOT, rel)); }
function write(rel, content) {
  const file = path.join(DIST, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function chars(s) { return [...s].length; }
function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function deepMerge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = isObj(v) && isObj(a[k]) ? deepMerge(a[k], v) : v;
  return out;
}
function parseJson(rel) {
  try { return JSON.parse(read(rel)); } catch (e) { errors.push(`${rel}: invalid JSON (${e.message})`); return null; }
}
function clean(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n').map(l => l.replace(/\s+$/, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim() + '\n';
}

// ---------- game_spec ----------
const base = parseJson('common/game_spec.base.json');
const specs = { '00-template-zero': { genre: base, merged: base } };
for (const g of config.genres) {
  const rel = `genres/${g}/game_spec.json`;
  if (!exists(rel)) { warnings.push(`${rel} missing`); continue; }
  const genre = parseJson(rel);
  if (!genre || !base) continue;
  const merged = deepMerge(base, genre);
  specs[g] = { genre, merged };
  write(`game_spec/${g}.json`, JSON.stringify(merged, null, 2) + '\n');
  lintSpec(g, merged);
}

function lintSpec(id, spec) {
  const tokens = new Set(Object.keys(spec.style?.palette ?? {}));
  const walk = (node, p) => {
    if (Array.isArray(node)) return node.forEach((v, i) => walk(v, `${p}[${i}]`));
    if (!isObj(node)) return;
    for (const [k, v] of Object.entries(node)) {
      const here = `${p}.${k}`;
      if (typeof v === 'string' && /^#[0-9a-f]{3,8}$/i.test(v) && !here.startsWith('.style.palette'))
        errors.push(`${id}: hex color outside style.palette at ${here}`);
      if (/(^c|C)olor$/.test(k) && typeof v === 'string' && !tokens.has(v) && !here.startsWith('.style.palette'))
        errors.push(`${id}: unknown palette token "${v}" at ${here}`);
      if (/Ms$/.test(k)) warnings.push(`${id}: milliseconds key ${here} (use seconds)`);
      walk(v, here);
    }
  };
  walk(spec, '');
  if (!spec.meta?.scoreLabel) errors.push(`${id}: meta.scoreLabel missing`);
  if (!spec.limits) errors.push(`${id}: limits section missing`);
}

// ---------- prompts ----------
const shared = {
  A: exists('prompts/_shared/remix-preamble.md') ? clean(read('prompts/_shared/remix-preamble.md')).trim() : '',
  B: exists('prompts/_shared/common-block.md') ? clean(read('prompts/_shared/common-block.md')).trim() : '',
};
if (chars(shared.A) > config.preambleBudget) errors.push(`remix-preamble.md: ${chars(shared.A)} > ${config.preambleBudget}`);
if (chars(shared.B) > config.commonBlockBudget) errors.push(`common-block.md: ${chars(shared.B)} > ${config.commonBlockBudget}`);

function render(src, id, plan) {
  const spec = specs[id];
  return src
    .replace(/\{\{BASE\}\}/g, () => (plan === 'A' ? shared.A : shared.B))
    .replace(/\{\{GAME_SPEC(?::([\w,]+))?\}\}/g, (_, sections) => {
      if (!spec) { errors.push(`${id}: {{GAME_SPEC}} used but no game_spec`); return ''; }
      if (!sections) return JSON.stringify(spec.genre);
      const pick = {};
      for (const s of sections.split(',')) {
        if (!(s in spec.genre)) errors.push(`${id}: section "${s}" not in genre game_spec`);
        else pick[s] = spec.genre[s];
      }
      return JSON.stringify(pick);
    })
    .replace(/\{\{include:([^}]+)\}\}/g, (_, rel) => {
      if (!exists(rel.trim())) { errors.push(`${id}: include ${rel} not found`); return ''; }
      return clean(read(rel.trim())).trim();
    });
}

const promptDirs = ['00-template-zero', ...config.genres];
for (const id of promptDirs) {
  const dir = `prompts/${id}`;
  if (!exists(dir)) { warnings.push(`${dir} missing`); continue; }
  const files = fs.readdirSync(path.join(ROOT, dir)).filter(f => /^p\d+\.md$/.test(f)).sort();
  if (!files.length) warnings.push(`${dir}: no p*.md`);
  for (const f of files) {
    const src = clean(read(`${dir}/${f}`));
    const plans = id === '00-template-zero' ? ['A'] : ['A', 'B'];
    const row = { id, file: f };
    for (const plan of plans) {
      const out = clean(render(src, id, plan));
      const n = chars(out);
      row[plan] = n;
      if (/\{\{[^}]*\}\}/.test(out)) errors.push(`${id}/${f} plan ${plan}: unresolved placeholder`);
      if (n > config.charLimit) errors.push(`${id}/${f} plan ${plan}: ${n} chars > ${config.charLimit}`);
      write(`plan${plan}/${id}/${f.replace('.md', '.txt')}`, out);
    }
    rows.push(row);
  }
}

// ---------- report ----------
const lines = [
  `# Build report`, '',
  `Limit: ${config.charLimit} characters per prompt (assumed PB limit ${config.assumedPbLimit}).`,
  `Remix preamble (plan A): ${chars(shared.A)} chars · Common block (plan B): ${chars(shared.B)} chars`, '',
  '| Prompt | Plan A | Plan B |', '|---|---:|---:|',
  ...rows.map(r => `| ${r.id}/${r.file} | ${r.A ?? '–'} | ${r.B ?? '–'} |`), '',
  errors.length ? `## Errors\n${errors.map(e => `- ${e}`).join('\n')}` : '## Errors\nNone.', '',
  warnings.length ? `## Warnings\n${warnings.map(w => `- ${w}`).join('\n')}` : '## Warnings\nNone.', '',
];
write('REPORT.md', lines.join('\n'));
if (process.argv.includes('--report')) console.log(lines.join('\n'));
else console.log(`${rows.length} prompts built, ${errors.length} error(s), ${warnings.length} warning(s). See dist/REPORT.md`);
if (errors.length) { if (!process.argv.includes('--report')) console.error(errors.join('\n')); process.exit(1); }
