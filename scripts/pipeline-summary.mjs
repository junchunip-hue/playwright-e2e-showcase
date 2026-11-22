// Writes the PR pipeline summary (GitHub job summary): a diagram of the run, every failed test with the step where it
// failed and the steps that did not run, and a TypeScript-vs-Java table per test ID. Inputs: Playwright JSON results,
// Surefire XML reports (+ the Java scenario log) and the job results from `needs`.
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
 * Failed tests (failed on every attempt), each with the Gherkin step where it failed and the steps after it, which did
 * not run. TS: the "failed step" and "not run" annotations of src/steps/not-run.hooks.ts. Java: the steps in the
 * scenario log (com.showcase.report.ScenarioLog), where Cucumber marks the steps after a failure as skipped.
 * Entries: { id, title, project, where, step, notRun: [...], error }
 */
const failedCases = [];

/**
 * The failure control (C IDs, features/control, ADR 0013): fails on purpose every night so the reports show what a
 * failure looks like. Never counted in the totals, the per-ID table, the verdict or the badge; listed in its own
 * section, with a warning if it did not fail. TS: in the merged results (the nightly runs it in shard 1, separately);
 * Java: its own reports, CONTROL_JAVA_DIR. Entries: { id, title, project, where, failed, step, notRun, error }
 */
const CONTROL = /^(C\d+):/;
const isControl = (title) => CONTROL.test(title);
const controlCases = [];

/**
 * Flaky = failed at least once, then passed on a retry. The run still passes, but each case is listed by name with
 * its attempts and first error, so it is fixed rather than retried forever.
 * Entries: { id, title, project, where, attempts: ['failed', 'passed', …], error }
 */
const flakyCases = [];
/**
 * An error in one line: Playwright's "Expected …" / "Received …" lines when it has them (they say what went wrong, in
 * TypeScript and in Playwright for Java), else the first line.
 */
const firstLine = (s) => {
  const lines = (s ?? '')
    .replace(/\u001b\[[0-9;]*m/g, '') // ANSI colours from Playwright's error output
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const detail = lines.filter((l) => /^(Expected|Received)( [\w ]+)?:/.test(l)).slice(0, 2);
  return detail.length === 2 ? detail.join(' · ') : (lines[0] ?? '');
};
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
  totals[lang] ??= { passed: 0, flaky: 0, failed: 0, notRun: 0, skipped: 0 };
  totals[lang][outcome]++;
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
        const last = t.results.at(-1);
        const note = (type) => (t.annotations ?? []).find((a) => a.type === type)?.description;
        const entry = () => ({
          title: spec.title,
          project: t.projectName,
          where: `tests/${spec.file}:${spec.line}`,
          step: note('failed step') ?? null,
          notRun: (note('not run') ?? '').split('\n').filter(Boolean),
          error: firstLine(last?.error?.message ?? last?.errors?.[0]?.message),
        });
        // The failure control fails on purpose: shown on its own, never counted.
        if (isControl(spec.title)) {
          controlCases.push({ id: CONTROL.exec(spec.title)[1], failed: t.status === 'unexpected', ...entry() });
          continue;
        }
        countRun('ts', OUTCOME[t.status] ?? 'failed');
        reportedTs.add(testKey(spec, t));
        if (t.status === 'unexpected') failedCases.push({ id: ID.exec(spec.title)?.[1] ?? '–', ...entry() });
      }
      const id = ID.exec(spec.title)?.[1];
      if (!id) continue;
      for (const t of spec.tests ?? []) {
        const r = byId.get(id) ?? tally();
        if (t.status === 'expected') r.passed++;
        else if (t.status === 'flaky') {
          r.flaky++;
          recordFlaky(id, spec, t);
        } else if (t.status === 'skipped') r.skipped++;
        else r.failed++;
        byId.set(id, r);
      }
    }
    (suite.suites ?? []).forEach(walk);
  };
  JSON.parse(readFileSync(file, 'utf8')).suites.forEach(walk);
  return byId;
}

/**
 * The Java scenario log (com.showcase.report.ScenarioLog, next to the XML): one JSON line per attempt, the last one per
 * scenario wins. It has every step with its status (passed, failed, skipped = not run after a failure).
 */
function javaScenarioLog(dir) {
  const file = dir && join(dir, 'scenarios.jsonl');
  const byName = new Map();
  if (!file || !existsSync(file)) return byName;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line);
      byName.set(entry.name, entry);
    } catch {
      // a line cut off by a crashed JVM: skip it
    }
  }
  return byName;
}
/** "Feature - Scenario" or "Feature - Outline - Examples - Example #1.1: Scenario" → the scenario's own name. */
const javaScenarioName = (testcaseName) =>
  testcaseName
    .split(' - ')
    .at(-1)
    .replace(/^Example #[\d.]+: /, '');

function javaResults(dir) {
  const byId = new Map();
  if (!dir || !existsSync(dir)) return byId;
  const log = javaScenarioLog(dir);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.xml'))) {
    const xml = readFileSync(join(dir, f), 'utf8');
    for (const m of xml.matchAll(/<testcase\b([^>]*?)(\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const name = /name="([^"]*)"/.exec(m[1])?.[1] ?? '';
      const body = m[3] ?? '';
      const failedHere = /<(failure|error)\b/.test(body);
      const entry = () => {
        const logged = log.get(javaScenarioName(xmlText(name)));
        // Steps and hooks in order (ScenarioLog); a failed hook is named as such, and only Gherkin steps count as not run.
        const steps = logged?.steps ?? [];
        const failedAt = steps.findIndex((s) => s.status === 'failed');
        const failed = steps[failedAt];
        const className = /classname="([^"]*)"/.exec(m[1])?.[1] ?? '';
        const message = /<(?:failure|error)\b[^>]*message="([^"]*)"/.exec(body)?.[1];
        return {
          title: javaScenarioName(xmlText(name)),
          project: 'Java (chromium)',
          // The feature file the scenario comes from (both languages run it); the runner class if the log is missing.
          where: logged?.uri ?? `java/src/test/java/${className.replaceAll('.', '/')}.java`,
          step: failed
            ? failed.hook
              ? `${failed.hook === 'before' ? 'Before' : 'After'} hook ${failed.text}`
              : failed.text
            : null,
          notRun:
            failedAt >= 0
              ? steps
                  .slice(failedAt + 1)
                  .filter((s) => !s.hook)
                  .map((s) => s.text)
              : [],
          error: firstLine(steps[failedAt]?.error ?? logged?.error ?? xmlText(message ?? '')),
        };
      };
      // The failure control: shown on its own, never counted (its own reports dir: CONTROL_JAVA_DIR).
      const scenario = javaScenarioName(xmlText(name));
      if (isControl(scenario)) {
        // Labelled like the TypeScript rows: C1 calls the API only (features/control/api-*), C2 runs in Chromium.
        const control = entry();
        const project = control.where.includes('features/control/api-') ? 'Java (api)' : 'Java (chromium)';
        controlCases.push({ id: CONTROL.exec(scenario)[1], failed: failedHere, ...control, project });
        continue;
      }
      if (failedHere) failedCases.push({ id: ID.exec(name)?.[1] ?? '–', ...entry() });
      countRun(
        'java',
        /<(failure|error)\b/.test(body)
          ? 'failed'
          : /<flaky(Failure|Error)\b/.test(body)
            ? 'flaky'
            : /<skipped\b/.test(body)
              ? 'skipped'
              : 'passed',
      );
      const id = ID.exec(name)?.[1];
      if (!id) continue;
      const r = byId.get(id) ?? tally();
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
// The Java failure control runs separately with its own reports; only its control entries are read from there.
if (process.env.CONTROL_JAVA_DIR) javaResults(process.env.CONTROL_JAVA_DIR);

/**
 * Tests that were planned but never ran (their job failed before or while running them). They are shown as
 * "⛔ not run", never as passed: a green row must mean the tests ran. TypeScript compares the planned list with the
 * results. Java writes no results when its job dies early; it runs the same A/U/S IDs as TypeScript (same tiers,
 * ADR 0009), so those IDs are not run there, count unknown.
 */
const plannedIds = new Set();
/** The planned list was asked for but is missing: tests that never ran cannot be detected, so no plain "Passed". */
let planUnavailable = Boolean(plannedFile);
if (plannedFile && existsSync(plannedFile)) {
  planUnavailable = false;
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
  if (r.skipped) parts.push(`${r.skipped} ⏭️ skipped`);
  return parts.join(' · ');
};
const coverage = (id) => (ts.has(id) && java.has(id) ? 'both' : ts.has(id) ? 'TypeScript' : 'Java');
const sum = (m) =>
  [...m.values()].reduce(
    (a, r) => ({
      passed: a.passed + r.passed,
      failed: a.failed + r.failed,
      flaky: a.flaky + r.flaky,
      notRun: a.notRun + r.notRun,
      skipped: a.skipped + r.skipped,
    }),
    { passed: 0, failed: 0, flaky: 0, notRun: 0, skipped: 0 },
  );

const tsJob = process.env.TS_JOB ?? 'unknown';
const javaJob = process.env.JAVA_JOB ?? 'unknown';
const tsSum = sum(ts);
const javaSum = sum(java);
const jobState = (job) => (job === 'success' ? 'ok' : job === 'skipped' || job === 'cancelled' ? 'skip' : 'bad');
/** A failed test is a failure whatever the job says; a flaky one turns a green lane gold ("passed with flaky"). */
/**
 * In CI nothing should skip: the only skips are for the public demo (@admin, S5), which CI never uses. A skip there
 * means a test silently did not run (e.g. a wrong BASE_URL made isPublicDemo true), so it counts like "not run".
 */
const inCi = Boolean(process.env.CI);
const state = (job, s) =>
  s.failed || s.notRun || (inCi && s.skipped) || jobState(job) === 'bad'
    ? 'bad'
    : s.flaky && jobState(job) === 'ok'
      ? 'flaky'
      : jobState(job);
const tsState = state(tsJob, tsSum);
const javaState = state(javaJob, javaSum);
const counts = (s) =>
  [
    `${s.passed} passed`,
    s.failed ? `❌ ${s.failed} failed` : '0 failed',
    s.flaky ? `⚠️ ${s.flaky} flaky` : '0 flaky',
    ...(s.notRun
      ? [
          s === javaSum && [...java.values()].some((r) => r.notRunCountUnknown)
            ? '⛔ not run'
            : `⛔ ${s.notRun} not run`,
        ]
      : []),
    ...(s.skipped ? [`⏭️ ${s.skipped} skipped`] : []),
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
      `  J2 --> J3["Java smoke (Cucumber)<br/>${counts(javaSum)}"]`,
    ];

/**
 * Failed jobs of this run (written by the workflow's "Collect failed jobs" step): name, link, failed steps and the
 * errors the job reported. A job can fail before any test runs (e.g. a browser install), and then the test tables
 * below are all green for what did run: this is what explains the red.
 */
function failedJobs(dir) {
  const file = dir && join(dir, 'jobs.json');
  if (!file || !existsSync(file)) return [];
  const GENERIC = /^Process completed with exit code \d+\.?$/;
  return (
    (JSON.parse(readFileSync(file, 'utf8')).jobs ?? [])
      // A job past its timeout-minutes can report "cancelled"; a cancelled run never gets here (summary: !cancelled()).
      .filter((j) => ['failure', 'timed_out', 'cancelled'].includes(j.conclusion))
      .map((j) => {
        const annotationsFile = join(dir, `annotations-${j.id}.json`);
        const annotations = existsSync(annotationsFile) ? JSON.parse(readFileSync(annotationsFile, 'utf8')) : [];
        const messages = (level) =>
          annotations
            .filter((a) => a.annotation_level === level && !GENERIC.test(a.message.trim()))
            .map((a) => firstLine(a.message));
        const errors = messages('failure');
        return {
          name: j.name,
          url: j.html_url,
          timedOut: j.conclusion !== 'failure',
          steps: (j.steps ?? [])
            .filter((s) => s.conclusion === 'failure' || s.conclusion === 'timed_out')
            .map((s) => s.name),
          // Errors first; without one, the job's warnings usually say what went wrong (e.g. each install attempt).
          why: errors.length ? errors : messages('warning').slice(0, 3),
        };
      })
  );
}
const failed = failedJobs(jobsDir);

/**
 * Earlier attempts of this run ("Re-run failed jobs", written as attempt-<n>.json by "Collect failed jobs"): which
 * jobs failed there. A rerun that passes must not read as a clean first run, so it says which attempt failed and why.
 */
const attempt = Number(process.env.GITHUB_RUN_ATTEMPT ?? 1);
function earlierAttempts(dir) {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir)
    .map((n) => /^attempt-(\d+)\.json$/.exec(n))
    .filter(Boolean)
    .map((m) => {
      const jobs = JSON.parse(readFileSync(join(dir, m[0]), 'utf8')).jobs ?? [];
      return {
        attempt: Number(m[1]),
        failed: jobs
          .filter((j) => ['failure', 'timed_out', 'cancelled'].includes(j.conclusion))
          .map((j) => ({
            name: j.name,
            url: j.html_url,
            step: (j.steps ?? []).find((s) => s.conclusion === 'failure' || s.conclusion === 'timed_out')?.name ?? null,
          })),
      };
    })
    .sort((a, b) => a.attempt - b.attempt);
}
const earlier = earlierAttempts(jobsDir);
const earlierFailed = earlier.filter((e) => e.failed.length);
const rerunNote = earlierFailed.length
  ? `Attempt ${attempt} of this run; ${earlierFailed.map((e) => `attempt ${e.attempt} failed (${e.failed.map((j) => (j.step ? `${j.name} at "${j.step}"` : j.name)).join(', ')})`).join('; ')}.`
  : '';
const firstFailure = failed[0];
const whereFailed = (j) => `**${j.name}**${j.steps.length ? ` at "${j.steps[0]}"` : j.timedOut ? ' (timed out)' : ''}`;

// One verdict for the whole run: failed beats flaky, flaky beats passed. GitHub renders the alert boxes in colour
// (red / gold / green).
const failedTotal = tsSum.failed + javaSum.failed;
const flakyTotal = flakyCases.length;
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
/** What made the run red, in order of what a reader needs first: failed tests, tests that never ran, a red job. */
const skippedTotal = tsSum.skipped + javaSum.skipped;
const problems = [
  ...(failedTotal
    ? [`${plural(failedTotal, 'test')} failed (TypeScript ${tsSum.failed}, Java ${javaSum.failed})`]
    : []),
  ...(tsSum.notRun ? [`${plural(tsSum.notRun, 'TypeScript test')} did not run`] : []),
  ...(javaSum.notRun
    ? [
        [...java.values()].some((r) => r.notRunCountUnknown)
          ? 'the Java suite did not run'
          : `${plural(javaSum.notRun, 'Java test')} did not run`,
      ]
    : []),
  ...(inCi && skippedTotal
    ? [
        `${plural(skippedTotal, 'test')} skipped in CI, where nothing should skip (TypeScript ${tsSum.skipped}, Java ${javaSum.skipped})`,
      ]
    : []),
];
const UNVERIFIED = 'the list of planned tests is missing, so tests that did not run cannot be detected';
const cause = firstFailure
  ? `${firstFailure.name}${firstFailure.why[0] ? `: ${firstFailure.why[0]}` : firstFailure.steps[0] ? ` failed at ${firstFailure.steps[0]}` : ' failed'}`
  : '';
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
          ...(planUnavailable ? [`> Also unverified: ${UNVERIFIED}.`] : []),
        ]
      : planUnavailable && (tsState === 'ok' || javaState === 'ok')
        ? [
            '> [!WARNING]',
            `> **Unverified:** every test that reported passed, but ${UNVERIFIED} (see the "List the planned TypeScript tests" step).`,
          ]
        : tsState === 'ok' || javaState === 'ok'
          ? ['> [!TIP]', '> **Passed:** no failed and no flaky tests.']
          : ['> [!NOTE]', `> **No result:** TypeScript job ${tsJob}, Java job ${javaJob}.`];
/** Passed now, but an earlier attempt of this run failed: gold like flaky, never a plain green "Passed". */
const passedOnRerun = !(tsState === 'bad' || javaState === 'bad') && earlierFailed.length > 0;
const verdictLines =
  passedOnRerun && verdict[0] === '> [!TIP]'
    ? [
        '> [!WARNING]',
        `> **Passed on a rerun:** every test passed on this attempt, but an earlier one did not. ${rerunNote}`,
      ]
    : rerunNote
      ? [...verdict, `> ${rerunNote}`]
      : verdict;

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

// Each failed test with its steps: the step that failed, and the steps after it, which did not run (Gherkin stops at
// the first failing step). A test outside the features (e.g. a quality spec) has no steps to show.
// The failure control (C IDs): fails on purpose, never counted. It shows, on a known example, what the report of a
// failed scenario looks like; a control that passed means that reporting needs a look.
const controlSection = controlCases.length
  ? [
      '## Failure controls (not counted)',
      '',
      `${[...new Set(controlCases.map((f) => f.id))].join(', ')} fail on purpose every night, outside the verdict, to show how a failure is`,
      'reported: the steps before it passed, the failing step with its error (a UI failure also with a screenshot of the',
      'page at that step), and the steps after it not run (test plan, "Control").',
      '',
      '| ID | Where | Result | Failed at step | Not run after it |',
      '|---|---|---|---|---|',
      ...controlCases.map((f) => {
        const result = f.failed ? 'failed, as intended' : '⚠️ did not fail: check the failure reporting';
        const step = f.step ? `❌ ${cellText(f.step)}` : '–';
        const error = f.error ? `<br/>\`${cellText(f.error.slice(0, 160))}\`` : '';
        const notRun = f.notRun.length ? f.notRun.map((s) => `⏭️ ${cellText(s)}`).join('<br/>') : '–';
        return `| ${f.id} | ${f.project} | ${result} | ${step}${error} | ${notRun} |`;
      }),
      '',
    ]
  : [];

const failedSection = failedCases.length
  ? [
      '## Failed tests',
      '',
      '| ID | Where | Test | Failed at step | Not run after it |',
      '|---|---|---|---|---|',
      ...failedCases.map(
        (f) =>
          `| ❌ ${f.id} | ${f.project} | ${cellText(f.title)}<br/>\`${f.where}\` | ${f.step ? `❌ ${cellText(f.step)}` : '–'}${f.error ? `<br/>\`${cellText(f.error.slice(0, 160))}\`` : ''} | ${f.notRun.length ? f.notRun.map((s) => `⏭️ ${cellText(s)}`).join('<br/>') : '–'} |`,
      ),
      '',
      'Each failed scenario stops at its first failing step; the steps after it are listed as not run. The TypeScript',
      'report and the Java results list them as skipped steps, at the same level as the others.',
      '',
    ]
  : [];

const md = [
  nightly ? '## Nightly regression' : '## PR pipeline',
  '',
  ...verdictLines,
  '',
  ...whatFailed,
  ...failedSection,
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
    ? [
        '⛔ not run = planned for this run but never started, because its job failed first (see What failed). ✅ counts only tests that ran.',
        '',
      ]
    : []),
  '| ID | TypeScript | Java | Coverage |',
  '|---|---|---|---|',
  // U6 is also S1, the first journey (test-plan alias): one test, shown with both IDs.
  ...ids.map(
    (id) => `| ${id === 'U6' ? 'U6 (S1)' : id} | ${cell(ts.get(id))} | ${cell(java.get(id))} | ${coverage(id)} |`,
  ),
  '',
  'Every A, U and S ID must show results in both columns (same tier, so same pipeline); N IDs are TypeScript-only (ADR 0009).',
  '',
  ...controlSection,
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
      ? `✅ Passed · ⚠️ ${flakyTotal} flaky: ${flakyNames}${planUnavailable ? ' · unverified (no planned list)' : ''}`
      : planUnavailable
        ? '⚠️ Unverified: passed what ran, but the planned test list is missing'
        : '✅ Passed: no failed and no flaky tests';
  // A rerun says so first (GitHub cuts the description at 140 characters): "Passed on attempt 2 (attempt 1 failed: …)".
  const first = earlierFailed[0];
  const earlierShort = first
    ? `attempt ${first.attempt} failed: ${first.failed[0].name}${first.failed[0].step ? ` at "${first.failed[0].step}"` : ''}`
    : '';
  const withRerun = !first
    ? description
    : failed
      ? `${description} · ${earlierShort}`
      : `✅ Passed on attempt ${attempt} (${earlierShort})${flakyTotal ? ` · ⚠️ ${flakyTotal} flaky: ${flakyNames}` : ''}`;
  const ran = [tsState, javaState].some((s) => s === 'ok' || s === 'flaky');
  // GitHub cuts status descriptions at 140 characters. No state (both lanes skipped or cancelled) = no status.
  const short = withRerun.length > 140 ? `${withRerun.slice(0, 139)}…` : withRerun;
  if (failed || ran)
    appendFileSync(process.env.GITHUB_OUTPUT, `state=${failed ? 'failure' : 'success'}\ndescription=${short}\n`);
  // For the nightly history (clean streak): one word per run.
  // A rerun after a failed attempt is not a clean nightly: 'rerun' breaks the streak like 'flaky' does.
  const word = failed
    ? 'failed'
    : flakyTotal
      ? 'flaky'
      : passedOnRerun
        ? 'rerun'
        : planUnavailable
          ? 'unverified'
          : ran
            ? 'passed'
            : 'none';
  appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${word}\n`);
}

// The nightly's README badge (shields.io endpoint format), published next to the report on GitHub Pages: test runs
// in both languages, and the same verdict colour as above (green passed, yellow passed with flaky or on a rerun, red
// failed).
if (process.env.BADGE_FILE) {
  const total = (k) => (totals.ts?.[k] ?? 0) + (totals.java?.[k] ?? 0);
  const [passed, flaky, failedRuns, notRunRuns, skippedRuns] = ['passed', 'flaky', 'failed', 'notRun', 'skipped'].map(
    total,
  );
  const failed = tsState === 'bad' || javaState === 'bad';
  const javaNotRun = [...java.values()].some((r) => r.notRunCountUnknown);
  // The run's date, so a badge that stopped updating does not pass for today's result.
  const date = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const parts = failed
    ? [
        ...(failedRuns ? [`${failedRuns} failed`] : []),
        ...(notRunRuns ? [`${notRunRuns} not run`] : []),
        ...(javaNotRun ? ['Java not run'] : []),
        ...(skippedRuns ? [`${skippedRuns} skipped`] : []),
        ...(failedRuns || notRunRuns || javaNotRun || skippedRuns
          ? [`${passed + flaky} passed`]
          : ['failed (a job ended red)']),
      ]
    : [
        `${passed + flaky} passed`,
        `${flaky} flaky`,
        ...(passedOnRerun ? [`on attempt ${attempt}`] : []),
        ...(planUnavailable ? ['unverified'] : []),
      ];
  const badge = {
    schemaVersion: 1,
    label: 'nightly',
    message: [...parts, date].join(' · '),
    color: failed ? 'red' : flaky || passedOnRerun || planUnavailable ? 'yellow' : 'brightgreen',
  };
  writeFileSync(
    process.env.BADGE_FILE,
    `${JSON.stringify(badge)}
`,
  );
}

// The same result as data, for the nightly's GitHub Pages landing page (scripts/pages-site.mjs).
if (process.env.SUMMARY_JSON) {
  const failedRun = tsState === 'bad' || javaState === 'bad';
  const ran = [tsState, javaState].some((s) => s === 'ok' || s === 'flaky');
  const { GITHUB_SERVER_URL, GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_RUN_NUMBER, GITHUB_SHA } = process.env;
  const data = {
    pipeline: nightly ? 'nightly' : 'pr',
    date: new Date().toISOString(),
    run: {
      number: GITHUB_RUN_NUMBER ? Number(GITHUB_RUN_NUMBER) : null,
      url: GITHUB_RUN_ID ? `${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}` : null,
      sha: (GITHUB_SHA ?? '').slice(0, 7),
    },
    verdict: failedRun
      ? 'failed'
      : flakyTotal
        ? 'flaky'
        : passedOnRerun
          ? 'rerun'
          : planUnavailable
            ? 'unverified'
            : ran
              ? 'passed'
              : 'none',
    attempt,
    earlierAttempts: earlier,
    rerunNote,
    problems,
    cause,
    lanes: {
      ts: { job: tsJob, state: tsState, runs: totals.ts, byId: tsSum },
      java: { job: javaJob, state: javaState, runs: totals.java, byId: javaSum },
    },
    rows: ids.map((id) => ({
      id,
      ts: ts.get(id) ?? null,
      java: java.get(id) ?? null,
      coverage: coverage(id),
    })),
    flaky: flakyCases,
    failed: failedCases,
    control: controlCases,
    failedJobs: failed,
  };
  writeFileSync(process.env.SUMMARY_JSON, `${JSON.stringify(data, null, 2)}\n`);
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
