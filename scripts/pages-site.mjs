// Builds the nightly's GitHub Pages landing page, so the README badges open one page for both languages:
//   index.html       the verdict, both lanes with their counts (the badge's total, split), the failure control,
//                    TypeScript vs Java per test ID, flaky tests, failed tests with their failed and not-run steps,
//                    and the nightly history
//   typescript/      the merged Playwright HTML report (put there by the workflow)
//   java/            the Java results as the same kind of Playwright HTML report (scripts/java-report.mjs, workflow)
// Usage: node scripts/pages-site.mjs <summary.json> <site-dir>
//   summary.json comes from pipeline-summary.mjs (env SUMMARY_JSON); <site-dir>/history.json and streak.json from
//   nightly-history.mjs. Missing inputs leave their section out instead of failing the publish.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [summaryFile, siteDir] = process.argv.slice(2);
if (!summaryFile || !siteDir) {
  console.error('Usage: node scripts/pages-site.mjs <summary.json> <site-dir>');
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

function landing(s) {
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
  // The failure control (C IDs): fails on purpose, never counted; shows on a known example how a failure is reported.
  // Named in the verdict box and on both lane cards (the TypeScript report counts it as 1 failed), and shown right
  // below the cards, so it is seen before the long tables.
  const control = s.control ?? [];
  const controlFailed = control.filter((f) => f.failed);
  const controlIds = [...new Set(control.map((f) => f.id))].join(', ');
  const controlNote = control.length
    ? `<br>Failure control ${esc(controlIds)}: ${controlFailed.length === control.length ? 'failed on purpose, as intended' : '⚠️ did not fail: check the failure reporting'}, not counted. <a href="#control">See where it failed ↓</a>`
    : '';
  const tsControl = control.filter((f) => !f.project.startsWith('Java')).length;
  const javaControl = control.length - tsControl;
  const controlHtml = control.length
    ? `<h2 id="control">Failure control (not counted)</h2>
<p>${esc(controlIds)} fail on purpose every night, in both languages, so this page always shows what a failure looks
like: the steps before it passed, the failing step with its error, and the steps after it not run. C1 is an API test
(no page, so no screenshot); C2 is a UI test, with a screenshot of the page at the failed step (click it in the report
to enlarge or download it). They are left out of the verdict, the counts above, the badge and the clean streak. Open
them in the <a href="typescript/#?q=@control">TypeScript report</a> or the <a href="java/#?q=@control">Java report</a>:
in both they are the failed tests.</p>
<div class="scroll"><table><tr><th>ID</th><th>Where</th><th>Result</th><th>Failed at step</th><th>Not run after it</th></tr>
${control.map((f) => `<tr><td>${esc(f.id)}</td><td>${esc(f.project)}</td><td>${esc(f.failed ? 'failed, as intended' : '⚠️ did not fail: check the failure reporting')}</td><td>${f.step ? `❌ ${esc(f.step)}` : '–'}${f.error ? `<br><code>${esc(f.error.slice(0, 200))}</code>` : ''}</td><td>${f.notRun.length ? f.notRun.map((st) => `⏭️ ${esc(st)}`).join('<br>') : '–'}</td></tr>`).join('\n')}
</table></div>`
    : '';

  const sections = [];
  sections.push(`<h1>Nightly results</h1>
<p class="muted">Playwright E2E Showcase: the same Gherkin scenarios in TypeScript and Java, against our own Toolshop.
<a href="${REPO}#readme">About the project</a></p>
<div class="verdict ${v.cls}"><strong>${v.icon} ${esc(v.title)}</strong>${failedText ? `: ${esc(failedText)}` : ''}<br>
${s.rerunNote ? `${esc(s.rerunNote)}<br>` : ''}${controlNote ? `${controlNote.slice(4)}<br>` : ''}
<span>${esc(when)}${s.run.url ? ` · <a href="${esc(s.run.url)}">run #${esc(s.run.number)}</a>` : ''}${s.run.sha ? ` · commit <a href="${REPO}/commit/${esc(s.run.sha)}"><code>${esc(s.run.sha)}</code></a>` : ''}</span></div>`);

  sections.push(`<div class="lanes">
<div class="lane"><h3>TypeScript</h3><div class="big">${total(ts.runs)}</div>
<div class="muted">${tsTests} test runs on Chromium, Firefox and WebKit${tsSetup ? ` + ${plural(tsSetup, 'sign-in setup')} (one per shard with browser tests)` : ''}</div><div>${esc(runCounts(ts.runs))}</div>
${tsControl ? `<div class="muted">The report also lists the failure controls as ${tsControl} failed (${total(ts.runs) + tsControl} tests in all): on purpose, not counted.</div>` : ''}
<a class="button" href="typescript/">Open the TypeScript report →</a></div>
<div class="lane"><h3>Java</h3><div class="big">${total(jv.runs)}</div>
<div class="muted">scenarios (Cucumber-JVM, Chromium), the same feature files</div><div>${esc(runCounts(jv.runs))}</div>
${javaControl ? `<div class="muted">The report also lists the failure controls as ${javaControl} failed (${total(jv.runs) + javaControl} tests in all): on purpose, not counted.</div>` : ''}
<a class="button" href="java/">Open the Java report →</a></div>
</div>
<p class="muted">The README's "nightly tests" badge shows ${badgeTotal} passed: TypeScript and Java together.</p>
${controlHtml}`);

  if (s.failedJobs?.length) {
    sections.push(`<h2>What failed</h2><div class="scroll"><table><tr><th>Job</th><th>Failed step</th><th>What it reported</th></tr>
${s.failedJobs.map((j) => `<tr><td>❌ <a href="${esc(j.url)}">${esc(j.name)}</a></td><td>${esc(j.steps.join(', ') || (j.timedOut ? 'timed out' : '–'))}</td><td>${j.why.map(esc).join('<br>') || 'see the job log'}</td></tr>`).join('\n')}
</table></div>`);
  }

  // Each failed test: the step where it failed, and the steps after it, which did not run.
  if (s.failed?.length) {
    sections.push(`<h2>Failed tests</h2><p>${plural(s.failed.length, 'test')} failed. Each stops at its first failing step; the steps after it did not run.</p>
<div class="scroll"><table><tr><th>ID</th><th>Where</th><th>Test</th><th>Failed at step</th><th>Not run after it</th></tr>
${s.failed.map((f) => `<tr><td>❌ ${esc(f.id)}</td><td>${esc(f.project)}</td><td>${esc(f.title)}<br><code>${esc(f.where)}</code></td><td>${f.step ? `❌ ${esc(f.step)}` : '–'}${f.error ? `<br><code>${esc(f.error.slice(0, 200))}</code>` : ''}</td><td>${f.notRun.length ? f.notRun.map((st) => `⏭️ ${esc(st)}`).join('<br>') : '–'}</td></tr>`).join('\n')}
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
      `<tr><td>${esc(withAlias(r.id))}</td><td>${cell(r.ts)}</td><td>${cell(r.java)}</td><td>${esc(r.coverage)}</td></tr>`,
  )
  .join('\n')}
</table></div>
<p class="muted">Every A, U and S ID runs in both languages; N IDs (visual, accessibility, architecture) are TypeScript-only.
TypeScript runs U and S IDs once per browser (Chromium, Firefox, WebKit), A and N IDs once. U6 is also S1, the first journey.${control.length ? ` The failure control (${esc(controlIds)}) is not in this table: it is shown above, not counted.` : ''}</p>`);

  if (history.length) {
    const cls = { passed: 'ok', flaky: 'flaky', rerun: 'flaky', failed: 'bad', unverified: 'flaky' };
    const recent = history.slice(-30).reverse();
    sections.push(`<h2 id="history">Nightly history</h2>
<p>${streak ? `<strong>${esc(streakText(streak.message))}</strong> (no failed, flaky, skipped or not-run test in either language, and no rerun; the failure control does not count). ` : ''}Latest first; each links to its run.</p>
<div class="dots">${recent.map((r) => `<a class="dot ${cls[r.verdict] ?? 'skip'}" href="${REPO}/actions/runs/${esc(r.id)}" title="${esc(`#${r.run} · ${r.date} · ${r.verdict}${r.note ? ` · ${r.note}` : ''}`)}">#${esc(r.run)}</a>`).join('')}</div>
<p class="muted">Green passed · gold flaky, passed on a rerun or unverified · red failed. Data: <a href="history.json">history.json</a>.</p>`);
  }

  sections.push(
    `<p class="muted" style="margin-top:32px">Java scenarios on this run: ${total(jv.runs)}${javaControl ? ', plus the failure control' : ''}. Built by <code>scripts/pages-site.mjs</code> from the same results as the run's summary; both reports are Playwright HTML reports (Java: <code>scripts/java-report.mjs</code>).</p>`,
  );
  return page('Nightly results · Playwright E2E Showcase', sections.join('\n'));
}

mkdirSync(siteDir, { recursive: true });
writeFileSync(join(siteDir, 'index.html'), landing(summary));
console.log(`Pages: index.html (verdict ${summary?.verdict ?? 'missing'})`);
