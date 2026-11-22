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
        // Each failed assertion's message and what it received (e.g. the cycle), one line each.
        const errors = (r?.errors ?? []).map((e) => {
          const lines = plain(e.message ?? '')
            .split('\n')
            .map((l) => l.trim());
          return [lines[0], lines.find((l) => /^Received/.test(l))].filter(Boolean).join(' · ');
        });
        tests.push({ title: spec.title, ok: r?.status === 'passed', error: errors.join('<br>') });
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
      ? bad
          .map(
            (t) =>
              `${esc(t.title)}: ${t.error
                .split('<br>')
                .map((e) => esc(e.slice(0, 200)))
                .join('<br>')}`,
          )
          .join('<br>')
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

// --- 2. Dependencies: cycles and layers in the whole repository, and what this PR adds ---------------------
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

// Dependency cycles anywhere in the repository, both languages; one the base branch did not have is this PR's.
const baseCycles = new Set(cyclesOf(then).map((c) => c.join('|')));
const cycles = cyclesOf(now).map((files) => ({ files, isNew: !baseCycles.has(files.join('|')) }));
const inNewCycle = (from, to) => cycles.some((c) => c.isNew && c.files.includes(from) && c.files.includes(to));

// Every dependency against the layers anywhere in the repository; one the base branch did not have is this PR's.
const oldPathOf = new Map(changes.map((f) => [f.path, f.oldPath ?? f.path]));
const hadEdge = (from, to) => (then.get(oldPathOf.get(from) ?? from) ?? new Set()).has(to);
const upward = [];
for (const [from, tos] of now)
  for (const to of tos) {
    const [, fromLayer, fromRank] = layer(from);
    const [, toLayer, toRank] = layer(to);
    if (fromRank > toRank) upward.push({ from, to, layers: `${fromLayer} → ${toLayer}`, isNew: !hadEdge(from, to) });
  }

// The dependencies this PR adds (in its changed files), each checked against the layers and the new cycles.
const newEdges = [];
for (const f of changes) {
  if (!now.has(f.path)) continue;
  for (const to of now.get(f.path)) {
    if (hadEdge(f.path, to)) continue;
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

const newCycles = cycles.filter((c) => c.isNew).length;
const newUpward = upward.filter((u) => u.isNew).length;
const plural = (n, word) => `${n} ${n === 1 ? word : word.replace(/y$/, 'ie')}${n === 1 ? '' : 's'}`;
rows.push(
  [
    'Dependency cycles (whole repository)',
    cycles.length
      ? `❌ ${plural(cycles.length, 'cycle')}${newCycles ? `, ${newCycles} new in this PR` : ', none from this PR'}`
      : '✅ none',
    'no file depends on itself through others: TypeScript imports and Java class references of every file under `src/`, `tests/` and `java/src/test/java`, new files and folders included',
  ],
  [
    'Layer direction (whole repository)',
    upward.length
      ? `⚠️ ${plural(upward.length, 'dependency')} against the layers${newUpward ? `, ${newUpward} new in this PR` : ', none from this PR'}`
      : '✅ every dependency points down',
    'steps → fixtures → pages → data → modules, api → config: a building block never uses what is built on it',
  ],
  [
    'Dependencies added by this PR',
    !newEdges.length
      ? '✅ none'
      : newEdges.some((e) => e.bad)
        ? `⚠️ ${newEdges.filter((e) => e.bad).length} of ${newEdges.length} with a problem`
        : `✅ ${newEdges.length}, all follow the layers`,
    'every dependency this PR adds, each checked in the table below',
  ],
);
if (cycles.length) failed++;

// --- 3. The comment ------------------------------------------------------------------------------------------------
const fromPr = newCycles + newUpward + newEdges.filter((e) => e.bad).length;
const verdict = failed
  ? `❌ **${plural(failed, 'check')} failed**: the framework itself breaks${cycles.length && !newCycles ? ' (a dependency cycle the base branch already has)' : ''}.`
  : fromPr
    ? `⚠️ **All checks pass, but this PR adds ${plural(newUpward, 'dependency')} against the layers** (below).`
    : upward.length
      ? `✅ **This PR adds no structural risk.** ${plural(upward.length, 'dependency')} against the layers already exist on the base branch (below).`
      : '✅ **No structural risk found**: all checks pass, no dependency cycle, every dependency points down the layers.';
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
const link = (f) => `[${f}](${blob(f)})`;
if (newEdges.length) {
  out.push(
    '### Dependencies added by this PR',
    '',
    'A file now uses another it did not use before (TypeScript import, Java class reference). Dependencies may only point down the layers, from the scenario to its building blocks; one that points up, or closes a cycle, ties the parts together so that a change in either breaks the other.',
    '',
    '| From | Now uses | Layers | Check |',
    '|---|---|---|---|',
    ...newEdges
      .sort((a, b) => b.bad - a.bad)
      .map((e) => `| ${link(e.from)} | ${link(e.to)} | ${e.layers} | ${e.check} |`),
    '',
  );
}
if (cycles.length) {
  out.push('### Dependency cycles', '');
  for (const c of cycles)
    out.push(
      `- ${c.isNew ? '**new in this PR**' : 'already on the base branch'}: ${c.files.map((f) => `\`${f}\``).join(' ↔ ')}`,
    );
  out.push('');
}
if (upward.length) {
  const table = [
    '| From | Uses | Layers | |',
    '|---|---|---|---|',
    ...upward
      .sort((a, b) => b.isNew - a.isNew)
      .map(
        (u) =>
          `| ${link(u.from)} | ${link(u.to)} | ${u.layers} | ${u.isNew ? '⚠️ new in this PR' : 'already on the base branch'} |`,
      ),
  ];
  out.push(
    ...(newUpward
      ? ['### Dependencies against the layers (whole repository)', '', ...table, '']
      : [
          '<details><summary><b>Dependencies against the layers already on the base branch</b> (not from this PR)</summary>',
          '',
          ...table,
          '',
          '</details>',
          '',
        ]),
  );
}
const pipeline = changes.filter((f) => f.path.startsWith('.github/'));
if (pipeline.length)
  out.push(
    `<sub>Pipeline files changed (${pipeline.map((f) => `\`${f.path}\``).join(', ')}): the architecture rules above re-checked that no workflow can trigger itself, loop or run without a time limit.</sub>`,
    '',
  );

const md = out.join('\n');
if (outMd) writeFileSync(outMd, md);
else console.log(md);
