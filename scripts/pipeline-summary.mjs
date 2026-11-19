// Writes the PR pipeline summary (GitHub job summary): a diagram of the run, a TypeScript-vs-Java table per test
// ID, and the known product defects (ADR 0010). Inputs: Playwright JSON results, Surefire XML reports and the job
// results from `needs`.
// Usage: node scripts/pipeline-summary.mjs <ts-results.json> <surefire-dir> [<failed-jobs-dir> [<ts-planned.json>]]
//   (env: TS_JOB, JAVA_JOB). ts-planned.json is `playwright test --list --reporter=json` for the same suite: every
//   planned test without a result is shown as not run.
import { appendFileSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [tsFile, javaDir, jobsDir, plannedFile] = process.argv.slice(2);
const ID = /\b([ASUN]\d+):/;
const ORDER = 'SUAN';

/** id → { passed, failed, flaky, skipped } */
const tally = () => ({ passed: 0, failed: 0, flaky: 0, skipped: 0, notRun: 0 });

/**
 * Known defects (src/known-defects.ts, com.showcase.api.KnownDefect) report one line per check:
 * "<summary> | <label> | answered <status> (today <today>, intended <intended>)". TS: test annotation "known defect";
 * Java: "known defect: <line>" in the test's <system-out>.
 */
const DEFECT_LINE = /^(.*?) \| (.*?) \| answered (\d+) \(today (\d+), intended (\d+)\)$/;
/** "id|summary" → { id, summary, ts?: check, java?: check }, where check = { label, answered, today, intended } */
const defects = new Map();
function recordDefect(id, lang, line) {
  const m = DEFECT_LINE.exec(line.trim());
  if (!m) return;
  const [, summary, label, answered, today, intended] = m;
  const key = `${id}|${summary}`;
  const d = defects.get(key) ?? { id, summary };
  d[lang] = { label, answered: Number(answered), today: Number(today), intended: Number(intended) };
  defects.set(key, d);
}

/**
 * Flaky = failed at least once, then passed on a retry. The run still passes, but each case is listed by name with
 * its attempts and first error, so it is fixed rather than retried forever.
 * Entries: { id, title, project, where, attempts: ['failed', 'passed', …], error }
 */
const flakyCases = [];
const firstLine = (s) =>
  (s ?? '')
    .replace(/\u001b\[[0-9;]*m/g, '') // ANSI colours from Playwright's error output
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean) ?? '';
function recordFlaky(id, spec, t) {
  const failure = t.results.find((r) => r.status !== 'passed');
  flakyCases.push({
    id,
    title: spec.title,
    project: t.projectName,
    where: `tests/${spec.file}:${spec.line}`,
    attempts: t.results.map((r) => r.status),
    error: firstLine(failure?.error?.message ?? failure?.errors?.[0]?.message),
  });
}

const xmlText = (s) =>
  (s ?? '').replace(/&(lt|gt|quot|apos|amp|#(\d+));/g, (_, name, code) =>
    code ? String.fromCharCode(Number(code)) : { lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' }[name],
  );

/** All test runs per language, with an ID or not (e.g. the login setup); the per-ID tables count only tests with an ID. */
const totals = { ts: null, java: null };
const countRun = (lang, outcome) => {
  totals[lang] ??= { passed: 0, flaky: 0, failed: 0, notRun: 0 };
  if (outcome !== 'skipped') totals[lang][outcome]++;
};

/** One key per test in a project, the same in the planned list and in the results (a shard repeats the setup). */
const testKey = (spec, t) => `${t.projectName}|${spec.file}|${spec.title}`;
const reportedTs = new Set();

function typescriptResults(file) {
  const byId = new Map();
  if (!file || !existsSync(file)) return byId;
  const OUTCOME = { expected: 'passed', flaky: 'flaky', skipped: 'skipped' };
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests ?? []) {
        countRun('ts', OUTCOME[t.status] ?? 'failed');
        reportedTs.add(testKey(spec, t));
      }
      const id = ID.exec(spec.title)?.[1];
      if (!id) continue;
      for (const t of spec.tests ?? []) {
        for (const a of t.annotations ?? []) if (a.type === 'known defect') recordDefect(id, 'ts', a.description ?? '');
        const r = byId.get(id) ?? tally();
        if (t.status === 'expected') r.passed++;
        else if (t.status === 'flaky') {
          r.flaky++;
          recordFlaky(id, spec, t);
        }
        else if (t.status === 'skipped') r.skipped++;
        else r.failed++;
        byId.set(id, r);
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  JSON.parse(readFileSync(file, 'utf8')).suites.forEach(walk);
  return byId;
}

function javaResults(dir) {
  const byId = new Map();
  if (!dir || !existsSync(dir)) return byId;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.xml'))) {
    const xml = readFileSync(join(dir, f), 'utf8');
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const name = /name="([^"]*)"/.exec(m[1])?.[1] ?? '';
      const body = m[3] ?? '';
      countRun(
        'java',
        /<(failure|error)\b/.test(body) ? 'failed' : /<flaky(Failure|Error)\b/.test(body) ? 'flaky' : /<skipped\b/.test(body) ? 'skipped' : 'passed',
      );
      const id = ID.exec(name)?.[1];
      if (!id) continue;
      const r = byId.get(id) ?? tally();
      for (const line of body.matchAll(/known defect: (.*)/g)) recordDefect(id, 'java', line[1]);
      // CI reruns a failed test (pom.xml, profile ci-retries). Failed on every attempt: <failure>/<error> (plus
      // <rerunFailure>s). Passed on a rerun: only <flakyFailure>/<flakyError>, one per failed attempt.
      const flakes = [...body.matchAll(/<flaky(Failure|Error)\b([^>]*)>/g)];
      if (/<(failure|error)\b/.test(body)) r.failed++;
      else if (flakes.length) {
        r.flaky++;
        const className = /classname="([^"]*)"/.exec(m[1])?.[1] ?? '';
        const message = /message="([^"]*)"/.exec(flakes[0][2])?.[1];
        const type = /type="([^"]*)"/.exec(flakes[0][2])?.[1];
        flakyCases.push({
          id,
          title: xmlText(name),
          project: 'Java (chromium)',
          where: `java/src/test/java/${className.replaceAll('.', '/')}.java`,
          attempts: [...flakes.map(() => 'failed'), 'passed'],
          error: firstLine(xmlText(message ?? type)),
        });
      } else if (/<skipped\b/.test(body)) r.skipped++;
      else r.passed++;
      byId.set(id, r);
    }
  }
  return byId;
}

const ts = typescriptResults(tsFile);
const java = javaResults(javaDir);

/**
 * Tests that were planned but never ran (their job failed before or while running them). They are shown as
 * "⛔ not run", never as passed: a green row must mean the tests ran. TypeScript compares the planned list with the
 * results. Java writes no results when its job dies early; it runs the same A/U/S IDs as TypeScript (same tiers,
 * ADR 0009), so those IDs are not run there, count unknown.
 */
const plannedIds = new Set();
if (plannedFile && existsSync(plannedFile)) {
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const id = ID.exec(spec.title)?.[1];
      if (id) plannedIds.add(id);
      for (const t of spec.tests ?? []) {
        if (reportedTs.has(testKey(spec, t))) continue;
        countRun('ts', 'notRun');
        if (!id) continue;
        const r = ts.get(id) ?? tally();
        r.notRun++;
        ts.set(id, r);
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  JSON.parse(readFileSync(plannedFile, 'utf8')).suites.forEach(walk);
}
const javaJobOk = (process.env.JAVA_JOB ?? 'unknown') === 'success';
if (!javaJobOk && !['skipped', 'cancelled'].includes(process.env.JAVA_JOB)) {
  for (const id of plannedIds) {
    if (!/^[ASU]/.test(id) || java.has(id)) continue;
    java.set(id, { ...tally(), notRun: 1, notRunCountUnknown: true });
  }
}
const ids = [...new Set([...ts.keys(), ...java.keys()])].sort(
  (a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]) || Number(a.slice(1)) - Number(b.slice(1)),
);

const cell = (r) => {
  if (!r) return '–';
  const parts = [];
  // "0 ✅" only when nothing else is there to say (e.g. all skipped is said below).
  if (r.passed || !(r.flaky || r.failed || r.skipped || r.notRun)) parts.push(`${r.passed} ✅`);
  if (r.notRun) parts.push(r.notRunCountUnknown ? '⛔ not run' : `${r.notRun} ⛔ not run`);
  if (r.flaky) parts.push(`${r.flaky} ⚠️ flaky`);
  if (r.failed) parts.push(`${r.failed} ❌`);
  if (r.skipped) parts.push(`${r.skipped} skipped`);
  return parts.join(' · ');
};
const coverage = (id) => (ts.has(id) && java.has(id) ? 'both' : ts.has(id) ? 'TypeScript' : 'Java');
const sum = (m) =>
  [...m.values()].reduce(
    (a, r) => ({ passed: a.passed + r.passed, failed: a.failed + r.failed, flaky: a.flaky + r.flaky, notRun: a.notRun + r.notRun }),
    { passed: 0, failed: 0, flaky: 0, notRun: 0 },
  );

const tsJob = process.env.TS_JOB ?? 'unknown';
const javaJob = process.env.JAVA_JOB ?? 'unknown';
const tsSum = sum(ts);
const javaSum = sum(java);
const jobState = (job) => (job === 'success' ? 'ok' : job === 'skipped' || job === 'cancelled' ? 'skip' : 'bad');
/** A failed test is a failure whatever the job says; a flaky one turns a green lane gold ("passed with flaky"). */
const state = (job, s) => (s.failed || s.notRun || jobState(job) === 'bad' ? 'bad' : s.flaky && jobState(job) === 'ok' ? 'flaky' : jobState(job));
const tsState = state(tsJob, tsSum);
const javaState = state(javaJob, javaSum);
const counts = (s) =>
  [
    `${s.passed} passed`,
    s.failed ? `❌ ${s.failed} failed` : '0 failed',
    s.flaky ? `⚠️ ${s.flaky} flaky` : '0 flaky',
    ...(s.notRun ? [s === javaSum && [...java.values()].some((r) => r.notRunCountUnknown) ? '⛔ not run' : `⛔ ${s.notRun} not run`] : []),
  ].join(' · ');

const nightly = process.env.PIPELINE === 'nightly';
const flow = nightly
  ? [
      'flowchart LR',
      '  PR([Nightly 02:00 UTC]) --> TS1[3 shards × Chromium,<br/>Firefox, WebKit]',
      '  TS1 --> TS2[Toolshop per shard]',
      `  TS2 --> TS3["Merged TypeScript report<br/>${counts(tsSum)}"]`,
      '  PR --> J1[Compile + Chromium]',
      '  J1 --> J2[Toolshop in Docker]',
      `  J2 --> J3["Java full suite<br/>${counts(javaSum)}"]`,
    ]
  : [
      'flowchart LR',
      '  PR([Pull request]) --> TS1[Static checks<br/>lint · types · tags · architecture]',
      '  TS1 --> TS2[Toolshop in Docker]',
      `  TS2 --> TS3["TypeScript suite pr<br/>${counts(tsSum)}"]`,
      '  PR --> J1[Compile + Chromium]',
      '  J1 --> J2[Toolshop in Docker]',
      `  J2 --> J3["Java JUnit smoke<br/>${counts(javaSum)}"]`,
    ];

/** State of one language's check: still present (green, tracked), fixed (red: replace the marker), or unexpected. */
const defectState = (c) => {
  if (!c) return { icon: '–', text: '–' };
  if (c.answered === c.today) return { icon: '🟨', text: `🟨 still present (${c.answered})` };
  if (c.answered === c.intended) return { icon: '🟥', text: `🟥 **fixed** (${c.answered}): replace the marker with a plain assertion` };
  return { icon: '❌', text: `❌ unexpected ${c.answered} (today ${c.today}, intended ${c.intended})` };
};
const defectRows = [...defects.values()].sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
const defectsOpen = defectRows.filter((d) => [d.ts, d.java].some((c) => c && c.answered === c.today)).length;
const defectSection = defectRows.length
  ? [
      `## Known defects (${defectsOpen} still present)`,
      '',
      '| ID | Defect | Request | TypeScript | Java |',
      '|---|---|---|---|---|',
      ...defectRows.map(
        (d) =>
          `| ${d.id} | ${d.summary} | ${(d.ts ?? d.java).label} | ${defectState(d.ts).text} | ${defectState(d.java).text} |`,
      ),
      '',
      '🟨 the tests pass because the API still answers exactly as today: the defect is tracked, not fixed. 🟥 the API now',
      'answers as intended and the test fails on purpose. ❌ anything else. See ADR 0010.',
      '',
    ]
  : [];
const knownIds = new Set(defectRows.map((d) => d.id));

/**
 * Failed jobs of this run (written by the workflow's "Collect failed jobs" step): name, link, failed steps and the
 * errors the job reported. A job can fail before any test runs (e.g. a browser install), and then the test tables
 * below are all green for what did run: this is what explains the red.
 */
function failedJobs(dir) {
  const file = dir && join(dir, 'jobs.json');
  if (!file || !existsSync(file)) return [];
  const GENERIC = /^Process completed with exit code \d+\.?$/;
  return (JSON.parse(readFileSync(file, 'utf8')).jobs ?? [])
    .filter((j) => j.conclusion === 'failure' || j.conclusion === 'timed_out')
    .map((j) => {
      const annotationsFile = join(dir, `annotations-${j.id}.json`);
      const annotations = existsSync(annotationsFile) ? JSON.parse(readFileSync(annotationsFile, 'utf8')) : [];
      const messages = (level) =>
        annotations.filter((a) => a.annotation_level === level && !GENERIC.test(a.message.trim())).map((a) => firstLine(a.message));
      const errors = messages('failure');
      return {
        name: j.name,
        url: j.html_url,
        timedOut: j.conclusion === 'timed_out',
        steps: (j.steps ?? []).filter((s) => s.conclusion === 'failure' || s.conclusion === 'timed_out').map((s) => s.name),
        // Errors first; without one, the job's warnings usually say what went wrong (e.g. each install attempt).
        why: errors.length ? errors : messages('warning').slice(0, 3),
      };
    });
}
const failed = failedJobs(jobsDir);
const firstFailure = failed[0];
const whereFailed = (j) => `**${j.name}**${j.steps.length ? ` at "${j.steps[0]}"` : j.timedOut ? ' (timed out)' : ''}`;

// One verdict for the whole run: failed beats flaky, flaky beats passed. GitHub renders the alert boxes in colour
// (red / gold / green).
const failedTotal = tsSum.failed + javaSum.failed;
const flakyTotal = flakyCases.length;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** What made the run red, in order of what a reader needs first: failed tests, tests that never ran, a red job. */
const problems = [
  ...(failedTotal ? [`${plural(failedTotal, 'test')} failed (TypeScript ${tsSum.failed}, Java ${javaSum.failed})`] : []),
  ...(tsSum.notRun ? [`${plural(tsSum.notRun, 'TypeScript test')} did not run`] : []),
  ...(javaSum.notRun ? [[...java.values()].some((r) => r.notRunCountUnknown) ? 'the Java suite did not run' : `${plural(javaSum.notRun, 'Java test')} did not run`] : []),
];
const cause = firstFailure ? `${firstFailure.name}${firstFailure.why[0] ? `: ${firstFailure.why[0]}` : firstFailure.steps[0] ? ` failed at ${firstFailure.steps[0]}` : ' failed'}` : '';
const verdict =
  tsState === 'bad' || javaState === 'bad'
    ? [
        '> [!CAUTION]',
        problems.length
          ? `> **Failed:** ${problems.join('; ')}.${firstFailure ? ` Cause: ${whereFailed(firstFailure)}${firstFailure.why[0] ? `: ${firstFailure.why[0]}` : ''}. See [What failed](#what-failed).` : ''}`
          : firstFailure
            ? `> **Failed:** ${whereFailed(firstFailure)}${firstFailure.why[0] ? `: ${firstFailure.why[0]}` : ''}. See [What failed](#what-failed).`
            : `> **Failed:** a job ended red without a failed test (TypeScript job ${tsJob}, Java job ${javaJob}).`,
      ]
    : flakyTotal
      ? [
          '> [!WARNING]',
          `> **Passed with ${flakyTotal} flaky test${flakyTotal === 1 ? '' : 's'}:** every test passed in the end, but`,
          `> ${flakyTotal === 1 ? 'this one' : 'these'} failed first and passed only on a retry. See [Flaky tests](#flaky-tests) below.`,
        ]
      : tsState === 'ok' || javaState === 'ok'
        ? ['> [!TIP]', '> **Passed:** no failed and no flaky tests.']
        : ['> [!NOTE]', `> **No result:** TypeScript job ${tsJob}, Java job ${javaJob}.`];

const cellText = (s) => s.replaceAll('|', '\\|').replaceAll('`', "'");
const ATTEMPT = { passed: '✅', failed: '❌', timedOut: '⏱️', interrupted: '⏹️', skipped: '⏭️' };
const flakySection = flakyTotal
  ? [
      `## Flaky tests`,
      '',
      `${flakyTotal} test${flakyTotal === 1 ? '' : 's'} passed only on a retry. The run counts as passed, but a flaky test hides`,
      'a race in the test or the product: fix the cause (roadmap §6, "Keep it green"), do not raise the retries.',
      '',
      '| ID | Browser | Test | Attempts | First failure |',
      '|---|---|---|---|---|',
      ...flakyCases.map(
        (f) =>
          `| ⚠️ ${f.id} | ${f.project} | ${cellText(f.title)}<br/>\`${f.where}\` | ${f.attempts.map((a) => ATTEMPT[a] ?? a).join(' → ')} | ${f.error ? `\`${cellText(f.error.slice(0, 160))}\`` : '–'} |`,
      ),
      '',
      'Attempts: ✅ passed · ❌ failed · ⏱️ timed out. Both suites retry a failed test twice in CI. Traces of failed',
      'attempts: TypeScript in the HTML report (Flaky tab), Java in the `junit-reports-*-traces` artifact.',
      '',
    ]
  : [];

const whatFailed = failed.length
  ? [
      '## What failed',
      '',
      '| Job | Failed step | What it reported |',
      '|---|---|---|',
      ...failed.map(
        (j) =>
          `| ❌ [${cellText(j.name)}](${j.url}) | ${j.steps.length ? cellText(j.steps.join(', ')) : j.timedOut ? 'timed out' : '–'} | ${j.why.length ? j.why.map((w) => cellText(w)).join('<br/>') : 'see the job log'} |`,
      ),
      '',
    ]
  : [];

const md = [
  nightly ? '## Nightly regression' : '## PR pipeline',
  '',
  ...verdict,
  '',
  ...whatFailed,
  '```mermaid',
  ...flow,
  '  TS3 --> S([Summary])',
  '  J3 --> S',
  '  classDef ok fill:#EAF3DE,stroke:#3B6D11,color:#27500A',
  // Passed with flaky: gold fill inside a green border.
  '  classDef flaky fill:#FAEEDA,stroke:#3B6D11,stroke-width:3px,color:#633806',
  '  classDef bad fill:#FCEBEB,stroke:#A32D2D,color:#791F1F',
  '  classDef skip fill:#F1EFE8,stroke:#5F5E5A,color:#444441',
  // Setup nodes follow the job; the result node carries the test verdict (passed / flaky / failed).
  `  class TS1,TS2 ${jobState(tsJob)}`,
  `  class TS3 ${tsState}`,
  `  class J1,J2 ${jobState(javaJob)}`,
  `  class J3 ${javaState}`,
  '```',
  '',
  `TypeScript job: **${tsJob}** · Java job: **${javaJob}**`,
  '',
  ...flakySection,
  '## TypeScript vs Java by test ID',
  '',
  ...(tsSum.notRun || javaSum.notRun
    ? ['⛔ not run = planned for this run but never started, because its job failed first (see What failed). ✅ counts only tests that ran.', '']
    : []),
  '| ID | TypeScript | Java | Coverage |',
  '|---|---|---|---|',
  ...ids.map((id) => `| ${knownIds.has(id) ? `${id} 🟨` : id} | ${cell(ts.get(id))} | ${cell(java.get(id))} | ${coverage(id)} |`),
  '',
  'Every A, U and S ID must show results in both columns (same tier, so same pipeline); N IDs are TypeScript-only (ADR 0009).',
  knownIds.size ? '🟨 = the ID tracks a known product defect (see below).' : '',
  '',
  ...defectSection,
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else process.stdout.write(md);

// The verdict as a commit status (posted by the workflow): a green check for Passed and for Passed with flaky, whose
// description names the flaky tests; a red cross for Failed. GitHub shows it next to the commit and in the PR checks.
if (process.env.GITHUB_OUTPUT) {
  const failed = tsState === 'bad' || javaState === 'bad';
  const flakyNames = flakyCases.map((f) => `${f.id} ${f.project}`).join(', ');
  const description = failed
    ? problems.length || cause
      ? `❌ Failed: ${[...problems, ...(cause ? [cause] : [])].join(' · ')}`
      : `❌ Failed: a job ended red without a failed test (TypeScript ${tsJob}, Java ${javaJob})`
    : flakyTotal
      ? `✅ Passed · ⚠️ ${flakyTotal} flaky: ${flakyNames}`
      : '✅ Passed: no failed and no flaky tests';
  const ran = [tsState, javaState].some((s) => s === 'ok' || s === 'flaky');
  // GitHub cuts status descriptions at 140 characters. No state (both lanes skipped or cancelled) = no status.
  const short = description.length > 140 ? `${description.slice(0, 139)}…` : description;
  if (failed || ran) appendFileSync(process.env.GITHUB_OUTPUT, `state=${failed ? 'failure' : 'success'}\ndescription=${short}\n`);
}

// The nightly's README badge (shields.io endpoint format), published next to the report on GitHub Pages: test runs
// in both languages, and the same verdict colour as above (green passed, yellow passed with flaky, red failed).
if (process.env.BADGE_FILE) {
  const all = ['passed', 'flaky', 'failed', 'notRun'].map((k) => (totals.ts?.[k] ?? 0) + (totals.java?.[k] ?? 0));
  const [passed, flaky, failedRuns, notRunRuns] = all;
  const failed = tsState === 'bad' || javaState === 'bad';
  const javaNotRun = [...java.values()].some((r) => r.notRunCountUnknown);
  const badge = {
    schemaVersion: 1,
    label: 'nightly',
    message: failed
      ? [
          ...(failedRuns ? [`${failedRuns} failed`] : []),
          ...(notRunRuns ? [`${notRunRuns} not run`] : []),
          ...(javaNotRun ? ['Java not run'] : []),
          ...(failedRuns || notRunRuns || javaNotRun ? [`${passed + flaky} passed`] : ['failed (a job ended red)']),
        ].join(' · ')
      : `${passed + flaky} passed · ${flaky} flaky`,
    color: failed ? 'red' : flaky ? 'yellow' : 'brightgreen',
  };
  writeFileSync(process.env.BADGE_FILE, `${JSON.stringify(badge)}\n`);
}

// A warning annotation per flaky test: it shows on the run page and in the PR's checks without opening the summary.
if (process.env.GITHUB_ACTIONS) {
  const esc = (s) => s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  for (const f of flakyCases) {
    const failedTries = f.attempts.length - 1;
    console.log(
      `::warning title=${esc(`Flaky: ${f.id} (${f.project})`).replaceAll(',', '%2C').replaceAll(':', '%3A')}::` +
        esc(
          `${f.title} failed ${failedTries}× and passed on attempt ${failedTries + 1} (${f.where}). First failure: ${f.error || 'no message'}`,
        ),
    );
  }
}
