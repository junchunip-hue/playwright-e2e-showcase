// Scenario impact of a pull request: which feature scenarios (and which of their steps) the changed code can affect,
// in TypeScript, Java or both, posted as the first PR comment by .github/workflows/pr-impact.yml.
//
// From each changed line to its code unit (a step definition, a page method, a module locator, a fixture, a helper),
// then to every unit that uses it, up to the step definitions, then to every scenario step whose sentence they match
// (scripts/impact/model.mjs). A changed feature line marks its scenario; a file every run depends on (config,
// fixtures' reporting, Hooks.java, …) marks every scenario of its language. Comment-only and import-only changes are
// left out. It lists what CAN be affected, so a reviewer knows what to check and what to run.
//
// Usage: node scripts/pr-impact.mjs [--base <rev>] [--out impact.md] [--json impact.json]
//   --base   the branch the PR merges into (default origin/master); the merge base with HEAD is compared.
import { writeFileSync } from 'node:fs';

import { changedFiles, git, loadModel, stepRegex, unitsAt, uses } from './impact/model.mjs';

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : fallback;
};
const baseRef = arg('--base', 'origin/master');
const outMd = arg('--out', null);
const outJson = arg('--json', null);

const base = git('merge-base', baseRef, 'HEAD').trim();
const headSha = (process.env.PR_HEAD_SHA || git('rev-parse', 'HEAD')).trim();
const repo =
  process.env.GITHUB_REPOSITORY ||
  /github\.com[/:]([^/]+\/[^/.]+)/.exec(git('remote', 'get-url', 'origin'))?.[1] ||
  'junchunip-hue/playwright-e2e-showcase';
const blob = (file, line) => `https://github.com/${repo}/blob/${headSha}/${file}${line ? `#L${line}` : ''}`;

const head = loadModel(null);
const before = loadModel(base);
const changes = changedFiles(base);
const allUnits = [...head.code.values()].flatMap((c) => c.units);
const scenarios = head.features.flatMap((f) => f.scenarios.map((sc) => ({ ...sc, file: f.file })));
const isBrowser = (sc) => !/^features\/(api\/|control\/api-)/.test(sc.file);
const LANGS = { ts: 'TypeScript', java: 'Java' };

// Files every run of a language depends on: a real change there can affect every scenario of that language.
const HUBS = [
  [
    /^(playwright\.config\.ts|package\.json|package-lock\.json|tsconfig\.json)$/,
    'ts',
    'configures every TypeScript run',
  ],
  [/^src\/tags\.ts$/, 'ts', 'decides which tests every suite runs'],
  [/^src\/config\/env\.ts$/, 'ts', 'sets the URLs and accounts of every TypeScript run'],
  [
    /^src\/fixtures\/(not-run|evidence)\.ts$|^src\/steps\/not-run\.hooks\.ts$/,
    'ts',
    'reports every TypeScript failure',
  ],
  [/^tests\/auth\.setup\.ts$/, 'ts', 'signs in before every TypeScript browser test', 'browser'],
  [/^java\/pom\.xml$|^java\/src\/test\/resources\//, 'java', 'configures every Java run'],
  [
    /^java\/src\/test\/java\/com\/showcase\/(RunCucumberTest|steps\/Hooks|report\/(?:ScenarioLog|ActionLog|ActionAgent)|config\/Env)\.java$/,
    'java',
    'runs around every Java scenario',
  ],
];

// --- 1. What changed: code units, feature lines, hubs ---------------------------------------------------------------
const changedUnits = new Map(); // unit → description of the change
const removedSteps = []; // step definitions whose sentence is gone: scenarios using the old sentence are affected
const hubs = []; // { file, lang, why, browser }
const featureChanges = []; // { scenario, lines: Set, reason }
const noImpact = [];
const key = (u) => `${u.lang}|${u.file}|${u.cls ?? ''}|${u.kind}|${u.name}`;
const headByKey = new Map(allUnits.map((u) => [key(u), u]));
const mark = (u, how) => {
  if (!changedUnits.has(u)) changedUnits.set(u, how);
};

for (const f of changes) {
  const real = f.added.size + f.removed.size > 0;
  const hub = HUBS.find(([re]) => re.test(f.path));
  if (hub) {
    if (real) hubs.push({ file: f.path, lang: hub[1], why: hub[2], browser: hub[3] === 'browser' });
    continue;
  }
  if (f.path.startsWith('features/') && f.path.endsWith('.feature')) {
    const now = head.features.find((x) => x.file === f.path);
    const then = before.features.find((x) => x.file === (f.oldPath ?? f.path));
    const touched = new Map();
    const touch = (sc, line, reason) => {
      const t = touched.get(sc.title) ?? { sc, lines: new Set(), reasons: new Set() };
      if (line) t.lines.add(line);
      t.reasons.add(reason);
      touched.set(sc.title, t);
    };
    if (now) {
      for (const n of f.added) {
        if (n >= now.header[0] && n <= now.header[1]) now.scenarios.forEach((sc) => touch(sc, null, 'feature header'));
        const sc = now.scenarios.find((s) => n >= s.start && n <= s.end);
        if (sc) touch(sc, n, then?.scenarios.some((s) => s.title === sc.title) ? 'changed' : 'new');
      }
      for (const n of f.removed) {
        if (then && n >= then.header[0] && n <= then.header[1])
          now.scenarios.forEach((sc) => touch(sc, null, 'feature header'));
        const old = then?.scenarios.find((s) => n >= s.start && n <= s.end);
        const sc = old && now.scenarios.find((s) => s.title === old.title || (s.id !== '–' && s.id === old.id));
        if (sc) touch(sc, null, 'changed');
      }
    }
    for (const t of touched.values()) featureChanges.push({ file: f.path, ...t });
    const gone = (then?.scenarios ?? []).filter(
      (s) => !now?.scenarios.some((x) => x.title === s.title || (s.id !== '–' && x.id === s.id)),
    );
    for (const s of gone)
      featureChanges.push({
        file: f.path,
        sc: { ...s, file: f.path },
        removed: true,
        lines: new Set(),
        reasons: new Set(['removed']),
      });
    if (!real) noImpact.push(f.path);
    continue;
  }
  const nowParsed = head.code.get(f.path);
  const thenParsed = before.code.get(f.oldPath ?? f.path);
  // Reporters shape the reports, not what a test does (the structure comment checks them).
  if (f.path.startsWith('src/reporters/')) {
    noImpact.push(`${f.path} (reporting only)`);
    continue;
  }
  if (!nowParsed && !thenParsed) {
    if (f.path.startsWith('src/visual/') && real) {
      for (const u of allUnits) if (u.kind === 'test' && /visual\.spec\.ts$/.test(u.file)) mark(u, 'screenshot styles');
    } else noImpact.push(f.path);
    continue;
  }
  if (!real) {
    noImpact.push(`${f.path} (comments or imports only)`);
    continue;
  }
  const added = [...f.added].filter((n) => !nowParsed?.importLines?.has(n));
  const removed = [...f.removed].filter((n) => !thenParsed?.importLines?.has(n));
  const inHead = unitsAt(nowParsed, added);
  const inBase = unitsAt(thenParsed, removed);
  if (added.some((n) => !inHead.some((u) => n >= u.start && n <= u.end)) || inHead.some((u) => u.kind === 'other'))
    nowParsed?.units.forEach((u) => mark(u, 'file'));
  for (const u of inHead) mark(u, 'changed');
  for (const b of inBase) {
    const same = headByKey.get(key({ ...b, file: f.path }));
    if (same) mark(same, 'changed');
    else if (b.kind === 'step') removedSteps.push(b);
    else mark({ ...b, file: f.path, removed: true }, 'removed');
  }
}
// A changed class header changes every member of the class.
for (const [u] of [...changedUnits])
  if (u.kind === 'class' && !u.removed)
    for (const m of allUnits) if (m.file === u.file && m.cls === u.cls) mark(m, 'class');

// --- 2. Who uses the changed units, up to steps and spec tests ---------------------------------------------------
const parent = new Map(); // unit → the unit it uses that brought it in
const reached = new Set(changedUnits.keys());
const queue = [...changedUnits.keys()];
for (let i = 0; i < queue.length; i++) {
  const v = queue[i];
  for (const u of allUnits) {
    if (reached.has(u) || !uses(head, u, v)) continue;
    reached.add(u);
    parent.set(u, v);
    queue.push(u);
  }
}
const label = (u) =>
  u.kind === 'fixture'
    ? `fixture ${u.name}`
    : u.kind === 'step' || u.kind === 'test'
      ? u.name
      : u.cls
        ? `${u.cls}.${u.name}`
        : (u.name ?? `${u.file.split('/').pop()}:${u.start}`);
const link = (u) => `[${label(u)}](${blob(u.file, u.removed ? null : u.start)})`;
const chainOf = (u) => {
  const chain = [];
  for (let x = parent.get(u); x; x = parent.get(x)) chain.unshift(x);
  if (chain.length > 3) chain.splice(1, chain.length - 3, { gap: true });
  return chain.map((x) => (x.gap ? '…' : link(x))).join(' → ');
};

// --- 3. Steps → scenarios --------------------------------------------------------------------------------------
const affected = new Map(); // scenario → { sc, steps: Map(line → { step, why: [] }), langs: Set, whole: [] }
const entry = (sc) => {
  const e = affected.get(sc) ?? { sc, steps: new Map(), langs: new Set(), whole: [] };
  affected.set(sc, e);
  return e;
};
const stepDefs = {
  ts: allUnits.filter((u) => u.kind === 'step' && u.lang === 'ts'),
  java: allUnits.filter((u) => u.kind === 'step' && u.lang === 'java'),
};
const matches = (def, step) => {
  const re = stepRegex(def.name, def.regex);
  return step.texts.some((t) => re.test(t)) || (step.texts.length === 0 && re.test(step.text));
};
const addStep = (sc, step, lang, why) => {
  const e = entry(sc);
  e.langs.add(lang);
  const s = e.steps.get(step.line) ?? { step, why: new Set(), byLang: new Map(), langs: new Set() };
  s.why.add(why);
  s.byLang.set(lang, new Set([...(s.byLang.get(lang) ?? []), why]));
  s.langs.add(lang);
  e.steps.set(step.line, s);
};
for (const u of reached) {
  if (u.kind !== 'step') continue;
  const why = changedUnits.has(u) ? `step definition ${link(u)} changed` : chainOf(u);
  for (const sc of scenarios) for (const step of sc.steps) if (matches(u, step)) addStep(sc, step, u.lang, why);
}
const undefinedSteps = [];
for (const b of removedSteps) {
  for (const sc of scenarios)
    for (const step of sc.steps)
      if (matches(b, step)) {
        const still = stepDefs[b.lang].some((d) => matches(d, step));
        addStep(
          sc,
          step,
          b.lang,
          still
            ? `old wording of a changed step definition (${b.file.split('/').pop()})`
            : `⚠️ no ${LANGS[b.lang]} step definition matches it any more`,
        );
        if (!still) undefinedSteps.push({ sc, step, lang: b.lang });
      }
}
// Hooks: a hook with tags affects the scenarios with that tag, otherwise every scenario of its language.
for (const u of reached) {
  if (u.kind !== 'hook') continue;
  for (const sc of scenarios)
    if (!u.tags || sc.tags.includes(u.tags)) {
      const e = entry(sc);
      e.langs.add(u.lang);
      e.whole.push(`hook ${link(u)} (${u.tags ?? 'every scenario'})`);
    }
}
for (const h of hubs)
  for (const sc of scenarios)
    if (!h.browser || isBrowser(sc)) {
      const e = entry(sc);
      e.langs.add(h.lang);
      e.whole.push(`[${h.file}](${blob(h.file)}) ${h.why}`);
    }
for (const fc of featureChanges) {
  if (fc.removed) continue;
  const sc = scenarios.find((s) => s.file === fc.file && s.title === fc.sc.title);
  if (!sc) continue;
  const e = entry(sc);
  e.langs.add('ts').add('java');
  e.featureReasons = [...fc.reasons];
  for (const step of sc.steps) {
    if (!fc.lines.has(step.line)) continue;
    // A new or reworded sentence must still match a step definition in each language.
    const missing = Object.keys(stepDefs).filter((lang) => !stepDefs[lang].some((d) => matches(d, step)));
    addStep(
      sc,
      step,
      'both',
      missing.length
        ? `changed in this PR; ⚠️ no ${missing.map((l) => LANGS[l]).join(' or ')} step definition matches it`
        : 'changed in this PR',
    );
    for (const lang of missing) undefinedSteps.push({ sc, step, lang });
  }
}
const tests = [...reached].filter((u) => u.kind === 'test');

// --- 4. The comment --------------------------------------------------------------------------------------------
const total = scenarios.length;
const cases = (sc) => sc.examples ?? 1;
const totalCases = scenarios.reduce((n, sc) => n + cases(sc), 0);
const list = [...affected.values()].sort((a, b) => a.sc.file.localeCompare(b.sc.file) || a.sc.start - b.sc.start);
const affectedCases = list.reduce((n, e) => n + cases(e.sc), 0);
const tier = (sc) => (sc.tags.includes('@smoke') ? 'smoke' : sc.tags.includes('@control') ? 'control' : 'regression');
const inPr = (sc) => (sc.tags.includes('@smoke') && !sc.tags.includes('@control') ? '✅' : '–');
const langCell = (langs) =>
  langs.has('both') || (langs.has('ts') && langs.has('java')) ? 'both' : langs.has('ts') ? 'TypeScript' : 'Java';
const esc = (s) => String(s).replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const out = [
  '<!-- pr-impact:scenarios -->',
  '## 🔎 Scenarios this PR can affect',
  '',
  `<sub>Head \`${headSha.slice(0, 7)}\` compared with \`${baseRef.replace(/^origin\//, '')}\` at \`${base.slice(0, 7)}\` · updated on every push · from the changed lines through the code that uses them to the step definitions and the scenario steps they match (\`scripts/pr-impact.mjs\`)</sub>`,
  '',
];

// What changed
const unitRows = [...changedUnits.entries()].filter(([u]) => u.kind !== 'class' || changedUnits.get(u) !== 'class');
const byFile = new Map();
for (const [u, how] of unitRows) {
  const list2 = byFile.get(u.file) ?? [];
  list2.push(how === 'removed' ? `~~${label(u)}~~` : u.kind === 'step' ? `step "${esc(u.name)}"` : esc(label(u)));
  byFile.set(u.file, list2);
}
for (const b of removedSteps) byFile.set(b.file, [...(byFile.get(b.file) ?? []), `~~step "${esc(b.name)}"~~`]);

if (list.length === 0 && tests.length === 0) {
  out.push(
    '**No scenario can be affected by this PR.** No feature, step definition or code a step uses has changed (comments and imports aside).',
    '',
  );
} else if (affected.size === total) {
  const why = [...new Set(list.flatMap((e) => e.whole))];
  out.push(
    `### ⚠️ Every scenario can be affected: ${total} scenarios (${totalCases} test cases), ${langCell(new Set(list.flatMap((e) => [...e.langs])))}`,
    '',
    ...(why.length ? why.map((w) => `- ${w}`) : ['- the changed code is used by every scenario']),
    '',
  );
} else {
  const nightly = list.filter((e) => inPr(e.sc) === '–' && tier(e.sc) !== 'control');
  out.push(
    `**${affected.size} of ${total} scenarios** (${affectedCases} of ${totalCases} test cases) can be affected${tests.length ? `, and ${tests.length} spec test${tests.length > 1 ? 's' : ''}` : ''}.` +
      (nightly.length ? ` ${nightly.length} of them run only in the nightly, not in this PR's smoke.` : ''),
    '',
  );
}
if (undefinedSteps.length)
  out.push(
    `> [!WARNING]\n> ${undefinedSteps.length} scenario step${undefinedSteps.length > 1 ? 's' : ''} no longer ${undefinedSteps.length > 1 ? 'have' : 'has'} a step definition: ${[...new Set(undefinedSteps.map((x) => `${x.sc.id} (${LANGS[x.lang]})`))].join(', ')}.`,
    '',
  );

if (byFile.size || hubs.length || featureChanges.length) {
  out.push('<details><summary><b>What changed</b></summary>', '', '| File | Changed |', '|---|---|');
  for (const h of hubs)
    out.push(
      `| [${h.file}](${blob(h.file)}) | ${h.why} (every ${LANGS[h.lang]} scenario${h.browser ? ' in a browser' : ''}) |`,
    );
  for (const [file, names] of byFile)
    out.push(
      `| [${file}](${blob(file)}) | ${[...new Set(names)].slice(0, 12).join(', ')}${names.length > 12 ? ', …' : ''} |`,
    );
  const byFeature = new Map();
  for (const fc of featureChanges)
    byFeature.set(fc.file, [...(byFeature.get(fc.file) ?? []), `${fc.sc.id} (${[...fc.reasons].join(', ')})`]);
  for (const [file, items] of byFeature) out.push(`| [${file}](${blob(file)}) | ${[...new Set(items)].join(', ')} |`);
  out.push('', '</details>', '');
}

if (list.length) {
  const every = affected.size === total;
  const features = [...new Set(list.map((e) => e.sc.file))];
  out.push(
    every ? '<details><summary><b>All scenarios, by feature</b></summary>\n' : '### Affected scenarios, by feature',
    '',
  );
  for (const file of features) {
    const rows = list.filter((e) => e.sc.file === file);
    const all = scenarios.filter((s) => s.file === file).length;
    out.push(
      `**[${file.replace(/^features\//, '')}](${blob(file)})**: ${rows.length} of ${all} scenario${all > 1 ? 's' : ''}`,
      '',
    );
    out.push('| ID | Scenario | Tier | PR smoke | Language | Affected steps, and why |', '|---|---|---|---|---|---|');
    for (const e of rows) {
      const sc = e.sc;
      const steps = [...e.steps.values()].sort((a, b) => a.step.line - b.step.line);
      const lines = [];
      if (e.featureReasons?.some((r) => r !== 'changed'))
        lines.push(`_scenario ${e.featureReasons.filter((r) => r !== 'changed').join(', ')} in this PR_`);
      for (const w of new Set(e.whole)) lines.push(`_every step: ${w}_`);
      // The step, then one line per language with its reason:
      //   `When I pay with "cash-on-delivery"`
      //   ↳ Java: CheckoutPage.pay
      //   ↳ TypeScript: CheckoutModule.finish → CheckoutPage.pay
      const ORDER = ['both', 'java', 'ts'];
      for (const s of steps) {
        const per = [...s.byLang]
          .sort(([a], [b]) => ORDER.indexOf(a) - ORDER.indexOf(b))
          .map(([lang, whys]) => {
            const why = [...whys].slice(0, 2).join('; ');
            return `↳ ${lang === 'both' ? why : `${LANGS[lang]}: ${why}`}`;
          });
        lines.push([`\`${esc(`${s.step.keyword} ${s.step.text}`)}\``, ...per].join('<br>'));
      }
      const id = `[${sc.id}](${blob(file, sc.line)})${sc.examples ? ` ×${sc.examples}` : ''}`;
      out.push(
        `| ${id} | ${esc(sc.title.replace(/^[A-Z]\d+:\s*/, ''))} | ${tier(sc)} | ${inPr(sc)} | ${langCell(e.langs)} | ${lines.join('<br><br>')} |`,
      );
    }
    out.push('');
  }
  if (every) out.push('</details>', '');
  const nightlyIds = [
    ...new Set(list.filter((e) => inPr(e.sc) === '–' && tier(e.sc) === 'regression').map((e) => e.sc.id)),
  ];
  if (nightlyIds.length && affected.size < total)
    out.push(
      `<sub>Not in this PR's smoke: ${nightlyIds.join(', ')}. To run them before merging: \`npx bddgen && npx playwright test --grep "${nightlyIds.map((i) => `${i}:`).join('|')}"\` (Java: \`./mvnw test -Dcucumber.filter.name="^(${nightlyIds.join('|')}): .*"\`).</sub>`,
      '',
    );
}

const gone = featureChanges.filter((fc) => fc.removed);
if (gone.length)
  out.push(`**Removed scenarios:** ${gone.map((fc) => `${fc.sc.id} ${esc(fc.sc.title)} (${fc.file})`).join(', ')}`, '');

if (tests.length) {
  out.push('### Spec tests (TypeScript)', '', '| Test | Why |', '|---|---|');
  for (const t of tests)
    out.push(
      `| [${esc(t.name)}](${blob(t.file, t.start)}) | ${changedUnits.has(t) ? 'changed in this PR' : chainOf(t)} |`,
    );
  out.push('');
}
if (noImpact.length)
  out.push(
    `<sub>No scenario impact: ${noImpact
      .slice(0, 20)
      .map((f) => `\`${f}\``)
      .join(', ')}${noImpact.length > 20 ? `, and ${noImpact.length - 20} more` : ''}.</sub>`,
    '',
  );

const md = out.join('\n');
if (outMd) writeFileSync(outMd, md);
else console.log(md);
if (outJson)
  writeFileSync(
    outJson,
    JSON.stringify(
      {
        base,
        head: headSha,
        total,
        affected: affected.size,
        hubs,
        changed: [...changedUnits.keys()].map((u) => ({ lang: u.lang, file: u.file, label: label(u), kind: u.kind })),
        files: changes.map((f) => f.path),
        reach: Object.fromEntries(
          [...byFile.keys()].map((file) => [
            file,
            list.filter((e) => [...e.steps.values()].some((s) => [...s.why].some((w) => w.includes(file)))).length,
          ]),
        ),
      },
      null,
      2,
    ),
  );
