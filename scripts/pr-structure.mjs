// Structure check of a pull request, posted as the second PR comment by .github/workflows/pr-impact.yml: can the
// change break the framework itself, beyond the scenarios the first comment lists?
//   - the static checks: architecture rules (N3), TypeScript types, Java compile, a Java step for every feature step
//     (Cucumber dry run), tags and test IDs, the step catalogue; each with its first error;
//   - how far the changed code reaches: the files that use it, directly and recursively, and whether it sits in a
//     dependency cycle;
//   - new dependencies the PR adds, and whether one points the wrong way through the layers (a module that uses a
//     page, a page that uses a step): the code then depends on something that depends on it.
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

// --- 2. Reach of the changed code, cycles, new dependencies -------------------------------------------------------
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
const users = new Map();
for (const [from, tos] of now) for (const to of tos) users.set(to, [...(users.get(to) ?? []), from]);
const reach = (file) => {
  const seen = new Set();
  const queue = [file];
  for (let i = 0; i < queue.length; i++)
    for (const u of users.get(queue[i]) ?? [])
      if (!seen.has(u)) {
        seen.add(u);
        queue.push(u);
      }
  return seen;
};
// Strongly connected components (Tarjan): a file in a component of two or more is in a cycle.
const cycleOf = new Map();
{
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
    for (const w of now.get(v) ?? []) {
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
      if (comp.length > 1) for (const f of comp) cycleOf.set(f, comp);
    }
  };
  for (const v of now.keys()) if (!idx.has(v)) visit(v);
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

const reachRows = [];
const newEdges = [];
for (const f of changes) {
  if (!now.has(f.path)) continue;
  const direct = users.get(f.path) ?? [];
  const all = reach(f.path);
  const cyc = cycleOf.get(f.path);
  reachRows.push([
    `[${f.path}](${blob(f.path)})`,
    direct.length,
    all.size,
    [...all].filter((x) => layer(x)[1] === 'steps').length,
    cyc ? `⚠️ ${cyc.map((x) => x.split('/').pop()).join(' ↔ ')}` : 'no',
  ]);
  const old = then.get(f.oldPath ?? f.path) ?? new Set();
  for (const to of now.get(f.path)) {
    if (old.has(to)) continue;
    const [, fromLayer, fromRank] = layer(f.path);
    const [, toLayer, toRank] = layer(to);
    newEdges.push([
      f.path,
      to,
      fromRank > toRank
        ? `⚠️ ${fromLayer} → ${toLayer}: a lower layer now depends on a higher one`
        : `${fromLayer} → ${toLayer}`,
    ]);
  }
}
const warnings = reachRows.filter((r) => r[4] !== 'no').length + newEdges.filter((e) => e[2].startsWith('⚠️')).length;

// --- 3. The comment ------------------------------------------------------------------------------------------------
const verdict = failed
  ? `❌ **${failed} check${failed > 1 ? 's' : ''} failed**: the framework itself breaks with this change, before any scenario runs.`
  : warnings
    ? `⚠️ **All checks pass, ${warnings} structural warning${warnings > 1 ? 's' : ''}** below.`
    : '✅ **No structural risk found**: all checks pass, no dependency cycle, no dependency against the layers.';
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
if (reachRows.length) {
  out.push(
    '### How far the changed code reaches',
    '',
    'Files that use each changed file, directly and through others (TypeScript imports, Java class names). A file used by many is a hub: a mistake there spreads. This counts files: every TypeScript step file imports the fixtures, which import every page, so the first comment narrows it down to the steps that really use the changed code.',
    '',
    '| Changed file | Used directly by | Used in total by | of which step or test files | In a dependency cycle |',
    '|---|---|---|---|---|',
    ...reachRows.sort((a, b) => b[2] - a[2]).map((r) => `| ${r.join(' | ')} |`),
    '',
  );
}
if (newEdges.length) {
  out.push(
    '### New dependencies',
    '',
    '| From | To | Layers |',
    '|---|---|---|',
    ...newEdges.map(([a, b, c]) => `| \`${a}\` | \`${b}\` | ${c} |`),
    '',
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
