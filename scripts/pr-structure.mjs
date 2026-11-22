// Structure check of a pull request, posted as the second PR comment by .github/workflows/pr-impact.yml: can the
// change break the framework itself, beyond the scenarios the first comment lists?
//   - the static checks: architecture rules (N3), TypeScript types, Java compile, a Java step for every feature step
//     (Cucumber dry run), tags and test IDs, the step catalogue; each with its first error;
//   - every dependency the PR adds (a file that now uses another), checked against the layers (a module that uses a
//     page, a page that uses a step points the wrong way) and against cycles the PR creates. How many files a change
//     reaches is not counted: the first comment already lists the scenarios and steps it affects.
//
// Usage: node scripts/pr-structure.mjs --checks <dir> [--base <rev>] [--out structure.md]
//   <dir> holds <check>.status (pass or fail) and <check>.log for each check, and arch.json (Playwright JSON report).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { changedFiles, git, loadModel } from './impact/model.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const dir = arg('--checks', 'pr-checks');
const baseRef = arg('--base', 'origin/master');
const outMd = arg('--out', null);
const base = git('merge-base', baseRef, 'HEAD').trim();
const headSha = (process.env.PR_HEAD_SHA || git('rev-parse', 'HEAD')).trim();
const repo =
  process.env.GITHUB_REPOSITORY ||
  /github\.com[/:]([^/]+\/[^/.]+)/.exec(git('remote', 'get-url', 'origin'))?.[1] ||
  'junchunip-hue/playwright-e2e-showcase';
const blob = (file) => `https://github.com/${repo}/blob/${headSha}/${file}`;
const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : null);

const plain = (s) => s.replace(/\u001b\[[0-9;]*m/g, '');
const esc = (s) => String(s).replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

// --- 1. Static checks ----------------------------------------------------------------------------------------------
const CHECKS = [
  ['typecheck', 'TypeScript types', 'every caller of changed TypeScript code still compiles'],
  ['java-compile', 'Java compiles', 'every caller of changed Java code still compiles (and Spotless style)'],
  ['java-dry-run', 'Java steps for every feature', 'Cucumber dry run: every feature step has a Java step definition'],
  ['tags', 'Tags and test IDs', 'one tier per test, known tags, an ID in every title'],
  ['steps', 'Step catalogue', 'up to date, every step used, every step in both languages'],
];
const firstError = (log) => {
  const lines = plain(log ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const hit = lines.find((l) => /error|✘|fail|missing|undefined|out of date|cannot|expected/i.test(l));
  return (hit ?? lines.at(-1) ?? '').slice(0, 220);
};

// Architecture rules: the Playwright JSON report, test by test.
const arch = (() => {
  const raw = read('arch.json');
  if (!raw) return null;
  const tests = [];
  const walk = (suite) => {
    for (const s of suite.suites ?? []) walk(s);
    for (const spec of suite.specs ?? [])
      for (const t of spec.tests ?? []) {
        const r = t.results?.at(-1);
        // The assertion's message, and what it received (e.g. the cycle), in one line.
        const lines = plain(r?.errors?.[0]?.message ?? '')
          .split('\n')
          .map((l) => l.trim());
        const received = lines.find((l) => /^Received/.test(l));
        tests.push({
          title: spec.title,
          ok: r?.status === 'passed',
          error: [lines[0], received].filter(Boolean).join(' · '),
        });
      }
  };
  try {
    walk(JSON.parse(raw));
  } catch {
    return null;
  }
  return tests;
})();

const rows = [];
let failed = 0;
if (arch) {
  const bad = arch.filter((t) => !t.ok);
  failed += bad.length ? 1 : 0;
  rows.push([
    'Architecture rules (N3)',
    bad.length ? `❌ ${bad.length} of ${arch.length} failed` : `✅ ${arch.length} passed`,
    bad.length
      ? bad.map((t) => `${esc(t.title)}: ${esc(t.error.slice(0, 160))}`).join('<br>')
      : 'pipeline cannot loop or hang, layer rules, TypeScript/Java parity',
  ]);
} else rows.push(['Architecture rules (N3)', '⚪ not run', 'no report']);
for (const [id, name, what] of CHECKS) {
  const status = read(`${id}.status`)?.trim();
  if (status === 'pass') rows.push([name, '✅ passed', what]);
  else if (status === 'fail') {
    failed++;
    rows.push([name, '❌ failed', esc(firstError(read(`${id}.log`)))]);
  } else rows.push([name, '⚪ not run', what]);
}

// --- 2. New dependencies: do they follow the layers, do they close a cycle? ------------------------------------
const head = loadModel(null);
const before = loadModel(base);
const changes = changedFiles(base).filter((f) => f.added.size + f.removed.size > 0);

/** File graph: TypeScript imports; Java files that name another file's class. */
function graphOf(model) {
  const edges = new Map();
  const javaByClass = new Map([...model.code.values()].filter((c) => c.lang === 'java').map((c) => [c.cls, c.file]));
  for (const c of model.code.values()) {
    const to = new Set();
    if (c.lang === 'ts') for (const f of c.imports) if (model.code.has(f)) to.add(f);
    if (c.lang === 'java') for (const [cls, f] of javaByClass) if (f !== c.file && c.tokens.has(cls)) to.add(f);
    edges.set(c.file, to);
  }
  return edges;
}
const now = graphOf(head);
const then = graphOf(before);

/** The dependency cycles of a graph: strongly connected components of two or more files (Tarjan). */
function cyclesOf(graph) {
  const cycles = [];
  let index = 0;
  const stack = [];
  const idx = new Map();
  const low = new Map();
  const on = new Set();
  const visit = (v) => {
    idx.set(v, index);
    low.set(v, index++);
    stack.push(v);
    on.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!idx.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v), low.get(w)));
      } else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
    }
    if (low.get(v) === idx.get(v)) {
      const comp = [];
      let w;
      do {
        w = stack.pop();
        on.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) cycles.push(comp.sort());
    }
  };
  for (const v of graph.keys()) if (!idx.has(v)) visit(v);
  return cycles;
}
// Only cycles this PR creates: one that already existed on the base branch is not this PR's doing.
const known = new Set(cyclesOf(then).map((c) => c.join('|')));
const newCycles = cyclesOf(now).filter((c) => !known.has(c.join('|')));

// Layers, from the scenario down: a dependency may only point down (or within a layer).
const LAYERS = [
  [/^tests\/|^src\/steps\/|\/steps\/[^/]*Steps\.java$|\/steps\/api\//, 'steps', 0],
  [/^src\/fixtures\/|\/steps\/(Hooks|PlaywrightContext|ScenarioContext)\.java$/, 'fixtures', 1],
  [/^src\/pages\/|\/pages\//, 'pages', 2],
  [/^src\/data\/|\/data\//, 'data', 3],
  [/^src\/modules\/|\/modules\//, 'modules', 4],
  [/^src\/api\/|\/api\/(ApiClient|Contracts)\.java$/, 'api', 4],
  [/^src\/config\/|\/config\//, 'config', 5],
];
const layer = (f) => LAYERS.find(([re]) => re.test(f)) ?? [null, 'support', 6];

// Every dependency the PR adds (in a changed file), checked against the layers and against new cycles.
const inNewCycle = (from, to) => newCycles.some((c) => c.includes(from) && c.includes(to));
const newEdges = [];
for (const f of changes) {
  if (!now.has(f.path)) continue;
  const old = then.get(f.oldPath ?? f.path) ?? new Set();
  for (const to of now.get(f.path)) {
    if (old.has(to)) continue;
    const [, fromLayer, fromRank] = layer(f.path);
    const [, toLayer, toRank] = layer(to);
    const problems = [];
    if (fromRank > toRank) problems.push(`against the layers: ${fromLayer} must not use ${toLayer}`);
    if (inNewCycle(f.path, to)) problems.push('closes a dependency cycle');
    newEdges.push({
      from: f.path,
      to,
      layers: fromLayer === toLayer ? `${fromLayer} (same layer)` : `${fromLayer} → ${toLayer}`,
      check: problems.length ? `⚠️ ${problems.join('; ')}` : '✅ follows the layers',
      bad: problems.length > 0,
    });
  }
}
const badEdges = newEdges.filter((e) => e.bad).length;
const warnings = badEdges + newCycles.length;
rows.push([
  'Dependencies',
  !newEdges.length && !newCycles.length
    ? '✅ none new'
    : warnings
      ? `⚠️ ${[badEdges && `${badEdges} against the layers`, newCycles.length && `${newCycles.length} new cycle${newCycles.length > 1 ? 's' : ''}`].filter(Boolean).join(', ')}`
      : `✅ ${newEdges.length} new, all follow the layers`,
  'new dependencies point down the layers (steps → fixtures → pages → data → modules, api → config) and close no cycle',
]);

// --- 3. The comment ------------------------------------------------------------------------------------------------
const verdict = failed
  ? `❌ **${failed} check${failed > 1 ? 's' : ''} failed**: the framework itself breaks with this change, before any scenario runs.`
  : warnings
    ? `⚠️ **All checks pass, ${warnings} structural warning${warnings > 1 ? 's' : ''}** below.`
    : '✅ **No structural risk found**: all checks pass, and no new dependency points against the layers or closes a cycle.';
const out = [
  '<!-- pr-impact:structure -->',
  '## 🧱 Structure check of this PR',
  '',
  `<sub>Head \`${headSha.slice(0, 7)}\` compared with \`${baseRef.replace(/^origin\//, '')}\` at \`${base.slice(0, 7)}\` · updated on every push · static: no Toolshop, no browser, separate from the smoke tests (\`scripts/pr-structure.mjs\`)</sub>`,
  '',
  verdict,
  '',
  '| Check | Result | What it guards, or the first error |',
  '|---|---|---|',
  ...rows.map((r) => `| ${r.join(' | ')} |`),
  '',
];
if (newEdges.length) {
  out.push(
    '### New dependencies in this PR',
    '',
    'A file now uses another it did not use before (TypeScript import, Java class name). Dependencies may only point down the layers, from the scenario to its building blocks; one that points up, or closes a cycle, ties the parts together so that a change in either breaks the other.',
    '',
    '| From | Now uses | Layers | Check |',
    '|---|---|---|---|',
    ...newEdges
      .sort((a, b) => b.bad - a.bad)
      .map((e) => `| [${e.from}](${blob(e.from)}) | [${e.to}](${blob(e.to)}) | ${e.layers} | ${e.check} |`),
    '',
  );
}
for (const c of newCycles)
  out.push(`> [!WARNING]\n> New dependency cycle: ${c.map((f) => `\`${f.split('/').pop()}\``).join(' ↔ ')}`, '');
const pipeline = changes.filter((f) => f.path.startsWith('.github/'));
if (pipeline.length)
  out.push(
    `<sub>Pipeline files changed (${pipeline.map((f) => `\`${f.path}\``).join(', ')}): the architecture rules above re-checked that no workflow can trigger itself, loop or run without a time limit.</sub>`,
    '',
  );

const md = out.join('\n');
if (outMd) writeFileSync(outMd, md);
else console.log(md);
