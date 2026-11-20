// Builds the nightly's GitHub Pages landing page, so the README badges open one page for both languages:
//   index.html       the verdict, both lanes with their counts (the badge's total, split), TypeScript vs Java per test
//                    ID, flaky tests, known defects and the nightly history
//   java/index.html  every Java scenario with its steps, read from the Surefire XML (reruns included)
//   typescript/      the merged Playwright HTML report (put there by the workflow)
// Usage: node scripts/pages-site.mjs <summary.json> <surefire-dir> <site-dir>
//   summary.json comes from pipeline-summary.mjs (env SUMMARY_JSON); <site-dir>/history.json and streak.json from
//   nightly-history.mjs. Missing inputs leave their section out instead of failing the publish.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [summaryFile, javaDir, siteDir] = process.argv.slice(2);
if (!summaryFile || !siteDir) {
  console.error('Usage: node scripts/pages-site.mjs <summary.json> <surefire-dir> <site-dir>');
  process.exit(2);
}
const REPO = 'https://github.com/junchunip-hue/playwright-e2e-showcase';
const read = (file) => {
  try {
    return file && existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  } catch {
    return null;
  }
};
const summary = read(summaryFile);
const history = read(join(siteDir, 'history.json')) ?? [];
const streak = read(join(siteDir, 'streak.json'));

const esc = (s) =>
  String(s ?? '').replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

const VERDICT = {
  passed: { cls: 'ok', icon: '✅', title: 'Passed', text: 'no failed and no flaky tests' },
  flaky: {
    cls: 'flaky',
    icon: '⚠️',
    title: 'Passed with flaky',
    text: 'every test passed in the end, but some only on a retry',
  },
  rerun: {
    cls: 'flaky',
    icon: '⚠️',
    title: 'Passed on a rerun',
    text: 'every test passed on this attempt, but an earlier one did not',
  },
  failed: { cls: 'bad', icon: '❌', title: 'Failed', text: '' },
  unverified: {
    cls: 'flaky',
    icon: '⚠️',
    title: 'Unverified',
    text: 'what ran passed, but the planned test list is missing',
  },
  none: { cls: 'skip', icon: '⏹️', title: 'No result', text: 'neither lane ran' },
};

// --- Java scenarios from the Surefire XML -----------------------------------------------------------------------

const xmlText = (s) =>
  (s ?? '').replace(/&(lt|gt|quot|apos|amp|#(\d+));/g, (_, name, code) =>
    code ? String.fromCharCode(Number(code)) : { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[name],
  );
// Cucumber's pretty output is coloured; Surefire stores the escape character as an entity.
const noAnsi = (s) => s.replace(/&amp#27;\[[0-9;]*m|&#27;\[[0-9;]*m|\u001b\[[0-9;]*m/g, '');
const STEP = { '✔': 'passed', '✘': 'failed', '↷': 'skipped', '?': 'undefined', '-': 'pending' };

/**
 * The Java scenario log (com.showcase.report.ScenarioLog): steps and known-defect notes per scenario, the last attempt
 * winning. In CI it is the only source of the steps of a passed scenario: with reruns on, Surefire leaves the output
 * of passed tests out of the XML. The XML stays the source of each scenario's status (it knows reruns: flaky).
 */
function scenarioLog(dir) {
  const file = dir && join(dir, 'scenarios.jsonl');
  const byName = new Map();
  if (!file || !existsSync(file)) return byName;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    try {
      if (line.trim()) byName.set(JSON.parse(line).name, JSON.parse(line));
    } catch {
      // a line cut off by a crashed JVM
    }
  }
  return byName;
}

function javaScenarios(dir) {
  if (!dir || !existsSync(dir)) return [];
  const log = scenarioLog(dir);
  const scenarios = [];
  for (const f of readdirSync(dir).filter((n) => n.startsWith('TEST-') && n.endsWith('.xml'))) {
    const xml = readFileSync(join(dir, f), 'utf8');
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const name = xmlText(/name="([^"]*)"/.exec(m[1])?.[1] ?? '');
      const body = m[3] ?? '';
      const time = Number(/time="([^"]*)"/.exec(m[1])?.[1] ?? 0);
      const flakes = [...body.matchAll(/<flaky(?:Failure|Error)\b([^>]*)>/g)];
      const status = /<(failure|error)\b/.test(body)
        ? 'failed'
        : flakes.length
          ? 'flaky'
          : /<skipped\b/.test(body)
            ? 'skipped'
            : 'passed';
      const message = xmlText(
        /<(?:failure|error)\b[^>]*message="([^"]*)"/.exec(body)?.[1] ??
          (flakes[0] ? /message="([^"]*)"/.exec(flakes[0][1])?.[1] : '') ??
          '',
      );
      // The scenario's own output is the last <system-out>; a rerun's failed attempts carry their own before it.
      const outs = [...body.matchAll(/<system-out><!\[CDATA\[([\s\S]*?)\]\]><\/system-out>/g)];
      const out = xmlText(noAnsi(outs.at(-1)?.[1] ?? ''));
      const steps = [];
      const notes = [];
      for (const raw of out.split('\n')) {
        const line = raw.trim();
        const step = /^([✔✘↷?-])\s+(.*?)(?:\s+#\s.*)?$/.exec(line);
        if (step && /^(Given|When|Then|And|But)\b/.test(step[2]))
          steps.push({ status: STEP[step[1]] ?? 'unknown', text: step[2] });
        else if (line.startsWith('known defect: ')) notes.push(line);
      }
      // "Feature - Scenario", and for a Scenario Outline "Feature - Outline - Examples - Example #1.1: Scenario".
      const [feature, ...rest] = name.split(' - ');
      const title = rest.at(-1)?.replace(/^Example #[\d.]+: /, '') ?? name;
      const logged = log.get(title);
      scenarios.push({
        feature,
        title,
        status,
        time,
        steps: logged?.steps?.length ? logged.steps : steps,
        notes: logged?.notes?.length ? logged.notes : notes,
        message: message.split('\n')[0],
        attempts: flakes.length,
      });
    }
  }
  return scenarios;
}

// --- Page shell ---------------------------------------------------------------------------------------------------

const STYLE = `
:root{--bg:#fff;--fg:#1f2328;--muted:#59636e;--line:#d1d9e0;--card:#f6f8fa;--link:#0969da;
--ok-bg:#eaf3de;--ok-fg:#27500a;--ok-line:#3b6d11;--flaky-bg:#faeeda;--flaky-fg:#633806;--flaky-line:#b07a1c;
--bad-bg:#fcebeb;--bad-fg:#791f1f;--bad-line:#a32d2d;--skip-bg:#f1efe8;--skip-fg:#444441;--skip-line:#5f5e5a}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#9198a1;--line:#3d444d;--card:#151b23;--link:#4493f8;
--ok-bg:#16260d;--ok-fg:#b5dd8f;--ok-line:#5a9a2a;--flaky-bg:#2e2210;--flaky-fg:#f0c674;--flaky-line:#b07a1c;
--bad-bg:#2d1212;--bad-fg:#f2a7a7;--bad-line:#c94a4a;--skip-bg:#1f1f1c;--skip-fg:#c9c7bf;--skip-line:#77766f}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}
main{max-width:980px;margin:0 auto;padding:24px 16px 48px}a{color:var(--link)}h1{font-size:24px;margin:0 0 4px}
h2{font-size:18px;margin:32px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--line)}.muted{color:var(--muted)}
.verdict{margin:18px 0;padding:14px 16px;border-radius:8px;border-left:5px solid}.verdict strong{font-size:17px}
.ok{background:var(--ok-bg);color:var(--ok-fg);border-color:var(--ok-line)}.flaky{background:var(--flaky-bg);color:var(--flaky-fg);border-color:var(--flaky-line)}
.bad{background:var(--bad-bg);color:var(--bad-fg);border-color:var(--bad-line)}.skip{background:var(--skip-bg);color:var(--skip-fg);border-color:var(--skip-line)}
.lanes{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px}
.lane{border:1px solid var(--line);border-radius:8px;padding:14px 16px;background:var(--card)}.lane h3{margin:0 0 6px;font-size:16px}
.big{font-size:28px;font-weight:600}.button{display:inline-block;margin-top:10px;padding:6px 12px;border-radius:6px;border:1px solid var(--line);text-decoration:none;background:var(--bg)}
table{width:100%;border-collapse:collapse;font-size:14px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
th{color:var(--muted);font-weight:600}.scroll{overflow-x:auto}code{font:12.5px ui-monospace,SFMono-Regular,Menlo,monospace}
.dots{display:flex;flex-wrap:wrap;gap:6px}.dot{display:inline-block;min-width:44px;text-align:center;padding:3px 6px;border-radius:6px;border:1px solid;text-decoration:none;font-size:13px}
details{border:1px solid var(--line);border-radius:6px;margin:6px 0;background:var(--card)}summary{cursor:pointer;padding:8px 10px}
details ol{margin:0 0 10px;padding:0 12px 0 40px}details p{margin:6px 12px}.step-failed,.step-undefined{color:var(--bad-fg)}.step-skipped,.step-pending{color:var(--muted)}`;

function page(title, body) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title><style>${STYLE}</style></head>
<body><main>${body}</main></body></html>
`;
}

// --- Landing page -------------------------------------------------------------------------------------------------

const cell = (r) => {
  if (!r) return '–';
  const parts = [];
  if (r.passed || !(r.flaky || r.failed || r.skipped || r.notRun)) parts.push(`${r.passed} ✅`);
  if (r.notRun) parts.push(r.notRunCountUnknown ? '⛔ not run' : `${r.notRun} ⛔ not run`);
  if (r.flaky) parts.push(`${r.flaky} ⚠️ flaky`);
  if (r.failed) parts.push(`${r.failed} ❌`);
  if (r.skipped) parts.push(`${r.skipped} ⏭️ skipped`);
  return parts.join(' · ');
};
const runCounts = (runs) => {
  if (!runs) return 'no results';
  return [
    `${runs.passed + runs.flaky} passed`,
    `${runs.flaky} flaky`,
    `${runs.failed} failed`,
    ...(runs.notRun ? [`${runs.notRun} not run`] : []),
    ...(runs.skipped ? [`${runs.skipped} skipped`] : []),
  ].join(' · ');
};
const total = (runs) => (runs ? runs.passed + runs.flaky + runs.failed + runs.notRun + runs.skipped : 0);
const rowRuns = (r) => (r ? r.passed + r.flaky + r.failed + r.notRun + r.skipped : 0);
/** Test-plan aliases (docs/test-plan.md, "How IDs work"): one test, two IDs. U6 is the first journey, S1. */
const ALIASES = { U6: 'S1' };
const withAlias = (id) => (ALIASES[id] ? `${id} (${ALIASES[id]})` : id);
/** The test plan's order: API, UI, journeys, then the TypeScript-only checks. */
const LAYER = 'AUSN';
const byPlanOrder = (a, b) => LAYER.indexOf(a[0]) - LAYER.indexOf(b[0]) || Number(a.slice(1)) - Number(b.slice(1));

/** "9 in a row" or "3 in a row (goal 5)" from streak.json → "9 clean nightlies in a row". */
const streakText = (message) => {
  const m = /^(\d+) in a row(.*)$/.exec(message ?? '');
  return m ? `${m[1]} clean ${Number(m[1]) === 1 ? 'nightly' : 'nightlies'} in a row${m[2]}` : message;
};

function landing(s, java) {
  if (!s) return page('Nightly results', '<h1>Nightly results</h1><p>No summary for the latest nightly.</p>');
  const v = VERDICT[s.verdict] ?? VERDICT.none;
  const when = new Date(s.date).toUTCString().replace(' GMT', ' UTC');
  const ts = s.lanes.ts;
  const jv = s.lanes.java;
  const badgeTotal = (ts.runs ? ts.runs.passed + ts.runs.flaky : 0) + (jv.runs ? jv.runs.passed + jv.runs.flaky : 0);
  const failedText =
    s.verdict === 'failed'
      ? [...s.problems, ...(s.cause ? [`cause: ${s.cause}`] : [])].join('; ') || 'a job ended red'
      : v.text;

  // The test runs with a plan ID, and the rest: the sign-in setup, which a shard runs before its browser tests.
  const tsTests = s.rows.reduce((n, r) => n + rowRuns(r.ts), 0);
  const tsSetup = Math.max(total(ts.runs) - tsTests, 0);
  const sections = [];
  sections.push(`<h1>Nightly results</h1>
<p class="muted">Playwright E2E Showcase: the same Gherkin scenarios in TypeScript and Java, against our own Toolshop.
<a href="${REPO}#readme">About the project</a></p>
<div class="verdict ${v.cls}"><strong>${v.icon} ${esc(v.title)}</strong>${failedText ? `: ${esc(failedText)}` : ''}<br>
${s.rerunNote ? `${esc(s.rerunNote)}<br>` : ''}
<span>${esc(when)}${s.run.url ? ` · <a href="${esc(s.run.url)}">run #${esc(s.run.number)}</a>` : ''}${s.run.sha ? ` · commit <a href="${REPO}/commit/${esc(s.run.sha)}"><code>${esc(s.run.sha)}</code></a>` : ''}</span></div>`);

  sections.push(`<div class="lanes">
<div class="lane"><h3>TypeScript</h3><div class="big">${total(ts.runs)}</div>
<div class="muted">${tsTests} test runs on Chromium, Firefox and WebKit${tsSetup ? ` + ${plural(tsSetup, 'sign-in setup')} (one per shard with browser tests)` : ''}</div><div>${esc(runCounts(ts.runs))}</div>
<a class="button" href="typescript/">Open the TypeScript report →</a></div>
<div class="lane"><h3>Java</h3><div class="big">${total(jv.runs)}</div>
<div class="muted">scenarios (Cucumber-JVM, Chromium), the same feature files</div><div>${esc(runCounts(jv.runs))}</div>
<a class="button" href="java/">Open the Java results →</a></div>
</div>
<p class="muted">The README's "nightly tests" badge shows ${badgeTotal} passed: TypeScript and Java together.</p>`);

  if (s.failedJobs?.length) {
    sections.push(`<h2>What failed</h2><div class="scroll"><table><tr><th>Job</th><th>Failed step</th><th>What it reported</th></tr>
${s.failedJobs.map((j) => `<tr><td>❌ <a href="${esc(j.url)}">${esc(j.name)}</a></td><td>${esc(j.steps.join(', ') || (j.timedOut ? 'timed out' : '–'))}</td><td>${j.why.map(esc).join('<br>') || 'see the job log'}</td></tr>`).join('\n')}
</table></div>`);
  }

  if (!s.flaky?.length && s.verdict !== 'failed' && s.verdict !== 'none') {
    sections.push('<h2>Flaky tests</h2><p>No flaky tests in this run: no test needed a retry to pass.</p>');
  }
  if (s.flaky?.length) {
    const ATTEMPT = { passed: '✅', failed: '❌', timedOut: '⏱️', interrupted: '⏹️', skipped: '⏭️' };
    sections.push(`<h2>Flaky tests</h2><p>${plural(s.flaky.length, 'test')} passed only on a retry: the run counts as passed, but the cause gets fixed.</p>
<div class="scroll"><table><tr><th>ID</th><th>Where</th><th>Test</th><th>Attempts</th><th>First failure</th></tr>
${s.flaky.map((f) => `<tr><td>⚠️ ${esc(f.id)}</td><td>${esc(f.project)}</td><td>${esc(f.title)}<br><code>${esc(f.where)}</code></td><td>${f.attempts.map((a) => ATTEMPT[a] ?? esc(a)).join(' → ')}</td><td><code>${esc((f.error ?? '').slice(0, 200)) || '–'}</code></td></tr>`).join('\n')}
</table></div>`);
  }

  sections.push(`<h2>TypeScript vs Java by test ID</h2><div class="scroll"><table><tr><th>ID</th><th>TypeScript</th><th>Java</th><th>Coverage</th></tr>
${[...s.rows]
  .sort((a, b) => byPlanOrder(a.id, b.id))
  .map(
    (r) =>
      `<tr><td>${esc(withAlias(r.id))}${r.knownDefect ? ' 🟨' : ''}</td><td>${cell(r.ts)}</td><td>${cell(r.java)}</td><td>${esc(r.coverage)}</td></tr>`,
  )
  .join('\n')}
</table></div>
<p class="muted">Every A, U and S ID runs in both languages; N IDs (visual, accessibility, architecture) are TypeScript-only.
TypeScript runs U and S IDs once per browser (Chromium, Firefox, WebKit), A and N IDs once. U6 is also S1, the first journey.${s.rows.some((r) => r.knownDefect) ? ' 🟨 = tracks a known product defect.' : ''}</p>`);

  if (s.defects?.length) {
    const label = { '🟨': '🟨 still present', '🟥': '🟥 fixed: replace the marker', '❌': '❌ unexpected', '–': '–' };
    sections.push(`<h2>Known defects</h2><div class="scroll"><table><tr><th>ID</th><th>Defect</th><th>Request</th><th>TypeScript</th><th>Java</th></tr>
${s.defects.map((d) => `<tr><td>${esc(d.id)}</td><td>${esc(d.summary)}</td><td>${esc((d.ts ?? d.java)?.label)}</td><td>${label[d.tsState] ?? esc(d.tsState)}</td><td>${label[d.javaState] ?? esc(d.javaState)}</td></tr>`).join('\n')}
</table></div>
<p class="muted">Tracked as tests (<a href="${REPO}/blob/master/docs/decisions/0010-known-defects-as-tests.md">ADR 0010</a>): green while the API answers exactly as today, red once it is fixed.</p>`);
  }

  if (history.length) {
    const cls = { passed: 'ok', flaky: 'flaky', rerun: 'flaky', failed: 'bad', unverified: 'flaky' };
    const recent = history.slice(-30).reverse();
    sections.push(`<h2 id="history">Nightly history</h2>
<p>${streak ? `<strong>${esc(streakText(streak.message))}</strong> (no failed, flaky, skipped or not-run test in either language, and no rerun). ` : ''}Latest first; each links to its run.</p>
<div class="dots">${recent.map((r) => `<a class="dot ${cls[r.verdict] ?? 'skip'}" href="${REPO}/actions/runs/${esc(r.id)}" title="${esc(`#${r.run} · ${r.date} · ${r.verdict}${r.note ? ` · ${r.note}` : ''}`)}">#${esc(r.run)}</a>`).join('')}</div>
<p class="muted">Green passed · gold flaky, passed on a rerun or unverified · red failed. Data: <a href="history.json">history.json</a>.</p>`);
  }

  sections.push(
    `<p class="muted" style="margin-top:32px">Java scenarios on this run: ${java.length}. Built by <code>scripts/pages-site.mjs</code> from the same results as the run's summary.</p>`,
  );
  return page('Nightly results · Playwright E2E Showcase', sections.join('\n'));
}

// --- Java page ----------------------------------------------------------------------------------------------------

function javaPage(scenarios, s) {
  const ICON = { passed: '✅', flaky: '⚠️', failed: '❌', skipped: '⏭️' };
  const byFeature = new Map();
  // Features in the test plan's order (API, UI, journeys), each by its first ID, as on the results page.
  const idOf = (sc) => /^([AUS]\d+):/.exec(sc.title)?.[1] ?? 'S999';
  for (const sc of [...scenarios].sort((a, b) => byPlanOrder(idOf(a), idOf(b)))) {
    byFeature.set(sc.feature, [...(byFeature.get(sc.feature) ?? []), sc]);
  }
  const count = (st) => scenarios.filter((x) => x.status === st).length;
  const head = `<p><a href="../">← Nightly results</a></p><h1>Java results</h1>
<p class="muted">Cucumber-JVM on JUnit 5, Chromium, the same feature files as TypeScript. Read from the Surefire XML, so a
scenario that passed on a rerun shows as flaky.${s?.run?.url ? ` <a href="${esc(s.run.url)}">Run #${esc(s.run.number)}</a>` : ''}</p>
<p><strong>${scenarios.length} scenarios</strong>: ${count('passed')} passed · ${count('flaky')} flaky · ${count('failed')} failed${count('skipped') ? ` · ${count('skipped')} skipped` : ''}</p>`;
  if (!scenarios.length) return page('Java results', `${head}<p>No Java results in this run.</p>`);
  const features = [...byFeature.entries()].map(
    ([feature, list]) => `<h2>${esc(feature)}</h2>
${list
  .map(
    (
      sc,
    ) => `<details${sc.status === 'failed' || sc.status === 'flaky' ? ' open' : ''}><summary>${ICON[sc.status] ?? ''} ${esc(sc.title.replace(/^([AUS]\d+):/, (_, id) => `${withAlias(id)}:`))} <span class="muted">${sc.time.toFixed(1)} s${sc.attempts ? ` · passed after ${plural(sc.attempts, 'failed attempt')}` : ''}</span></summary>
${sc.steps.length ? `<ol>${sc.steps.map((st) => `<li class="step-${st.status}">${st.status === 'passed' ? '' : `[${st.status}] `}${esc(st.text)}</li>`).join('')}</ol>` : ''}
${sc.message ? `<p class="step-failed"><code>${esc(sc.message.slice(0, 300))}</code></p>` : ''}${sc.notes.map((n) => `<p>🟨 <code>${esc(n)}</code></p>`).join('')}</details>`,
  )
  .join('\n')}`,
  );
  return page('Java results · Playwright E2E Showcase', `${head}${features.join('\n')}`);
}

const java = javaScenarios(javaDir);
mkdirSync(join(siteDir, 'java'), { recursive: true });
writeFileSync(join(siteDir, 'index.html'), landing(summary, java));
writeFileSync(join(siteDir, 'java', 'index.html'), javaPage(java, summary));
console.log(`Pages: index.html (verdict ${summary?.verdict ?? 'missing'}), java/index.html (${java.length} scenarios)`);
