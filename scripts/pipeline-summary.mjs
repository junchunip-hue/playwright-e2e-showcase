// Writes the PR pipeline summary (GitHub job summary): a diagram of the run, a TypeScript-vs-Java table per test
// ID, and the known product defects (ADR 0010). Inputs: Playwright JSON results, Surefire XML reports and the job
// results from `needs`.
// Usage: node scripts/pipeline-summary.mjs <ts-results.json> <surefire-dir>   (env: TS_JOB, JAVA_JOB)
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [tsFile, javaDir] = process.argv.slice(2);
const ID = /\b([ASUN]\d+):/;
const ORDER = 'SUAN';

/** id → { passed, failed, flaky, skipped } */
const tally = () => ({ passed: 0, failed: 0, flaky: 0, skipped: 0 });

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

function typescriptResults(file) {
  const byId = new Map();
  if (!file || !existsSync(file)) return byId;
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
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
      const id = ID.exec(name)?.[1];
      if (!id) continue;
      const r = byId.get(id) ?? tally();
      const body = m[3] ?? '';
      for (const line of body.matchAll(/known defect: (.*)/g)) recordDefect(id, 'java', line[1]);
      if (/<(failure|error)\b/.test(body)) r.failed++;
      else if (/<skipped\b/.test(body)) r.skipped++;
      else r.passed++;
      byId.set(id, r);
    }
  }
  return byId;
}

const ts = typescriptResults(tsFile);
const java = javaResults(javaDir);
const ids = [...new Set([...ts.keys(), ...java.keys()])].sort(
  (a, b) => ORDER.indexOf(a[0]) - ORDER.indexOf(b[0]) || Number(a.slice(1)) - Number(b.slice(1)),
);

const cell = (r) => {
  if (!r) return '–';
  const parts = [`${r.passed} ✅`];
  if (r.flaky) parts.push(`${r.flaky} ⚠️ flaky`);
  if (r.failed) parts.push(`${r.failed} ❌`);
  if (r.skipped) parts.push(`${r.skipped} skipped`);
  return parts.join(' · ');
};
const coverage = (id) => (ts.has(id) && java.has(id) ? 'both' : ts.has(id) ? 'TypeScript' : 'Java');
const sum = (m) => [...m.values()].reduce((a, r) => ({ passed: a.passed + r.passed, failed: a.failed + r.failed, flaky: a.flaky + r.flaky }), { passed: 0, failed: 0, flaky: 0 });

const tsJob = process.env.TS_JOB ?? 'unknown';
const javaJob = process.env.JAVA_JOB ?? 'unknown';
const tsSum = sum(ts);
const javaSum = sum(java);
const jobState = (job) => (job === 'success' ? 'ok' : job === 'skipped' || job === 'cancelled' ? 'skip' : 'bad');
/** A failed test is a failure whatever the job says; a flaky one turns a green lane gold ("passed with flaky"). */
const state = (job, s) => (s.failed || jobState(job) === 'bad' ? 'bad' : s.flaky && jobState(job) === 'ok' ? 'flaky' : jobState(job));
const tsState = state(tsJob, tsSum);
const javaState = state(javaJob, javaSum);
const counts = (s) =>
  [`${s.passed} passed`, s.failed ? `❌ ${s.failed} failed` : '0 failed', s.flaky ? `⚠️ ${s.flaky} flaky` : '0 flaky'].join(' · ');

const nightly = process.env.PIPELINE === 'nightly';
const flow = nightly
  ? [
      'flowchart LR',
      '  PR([Nightly 02:00 UTC]) --> TS1[3 shards × Chromium,<br/>Firefox, WebKit]',
      '  TS1 --> TS2[Toolshop per shard]',
      `  TS2 --> TS3["Merged TypeScript report<br/>${counts(tsSum)}"]`,
      '  PR --> J1[Compile + Chromium]',
      '  J1 --> J2[Toolshop in Docker]',
      `  J2 --> J3["Java full suite<br/>${javaSum.passed} passed · ${javaSum.failed} failed"]`,
    ]
  : [
      'flowchart LR',
      '  PR([Pull request]) --> TS1[Static checks<br/>lint · types · tags · architecture]',
      '  TS1 --> TS2[Toolshop in Docker]',
      `  TS2 --> TS3["TypeScript suite pr<br/>${counts(tsSum)}"]`,
      '  PR --> J1[Compile + Chromium]',
      '  J1 --> J2[Toolshop in Docker]',
      `  J2 --> J3["Java JUnit smoke<br/>${javaSum.passed} passed · ${javaSum.failed} failed"]`,
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

// One verdict for the whole run: failed beats flaky, flaky beats passed. GitHub renders the alert boxes in colour
// (red / gold / green).
const failedTotal = tsSum.failed + javaSum.failed;
const flakyTotal = flakyCases.length;
const verdict =
  tsState === 'bad' || javaState === 'bad'
    ? [
        '> [!CAUTION]',
        failedTotal
          ? `> **Failed:** ${failedTotal} test${failedTotal === 1 ? '' : 's'} failed (TypeScript ${tsSum.failed}, Java ${javaSum.failed}).`
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
      'Attempts: ✅ passed · ❌ failed · ⏱️ timed out. Traces of the failed attempts are in the HTML report (Flaky tab).',
      '',
    ]
  : [];

const md = [
  nightly ? '## Nightly regression' : '## PR pipeline',
  '',
  ...verdict,
  '',
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
