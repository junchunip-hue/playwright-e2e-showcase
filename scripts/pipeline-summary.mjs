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
        else if (t.status === 'flaky') r.flaky++;
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
const state = (job) => (job === 'success' ? 'ok' : job === 'skipped' || job === 'cancelled' ? 'skip' : 'bad');

const nightly = process.env.PIPELINE === 'nightly';
const flow = nightly
  ? [
      'flowchart LR',
      '  PR([Nightly 02:00 UTC]) --> TS1[3 shards × Chromium,<br/>Firefox, WebKit]',
      '  TS1 --> TS2[Toolshop per shard]',
      `  TS2 --> TS3["Merged TypeScript report<br/>${tsSum.passed} passed · ${tsSum.failed} failed · ${tsSum.flaky} flaky"]`,
      '  PR --> J1[Compile + Chromium]',
      '  J1 --> J2[Toolshop in Docker]',
      `  J2 --> J3["Java full suite<br/>${javaSum.passed} passed · ${javaSum.failed} failed"]`,
    ]
  : [
      'flowchart LR',
      '  PR([Pull request]) --> TS1[Static checks<br/>lint · types · tags · architecture]',
      '  TS1 --> TS2[Toolshop in Docker]',
      `  TS2 --> TS3["TypeScript suite pr<br/>${tsSum.passed} passed · ${tsSum.failed} failed · ${tsSum.flaky} flaky"]`,
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

const md = [
  nightly ? '## Nightly regression' : '## PR pipeline',
  '',
  '```mermaid',
  ...flow,
  '  TS3 --> S([Summary])',
  '  J3 --> S',
  '  classDef ok fill:#EAF3DE,stroke:#3B6D11,color:#27500A',
  '  classDef bad fill:#FCEBEB,stroke:#A32D2D,color:#791F1F',
  '  classDef skip fill:#F1EFE8,stroke:#5F5E5A,color:#444441',
  `  class TS1,TS2,TS3 ${state(tsJob)}`,
  `  class J1,J2,J3 ${state(javaJob)}`,
  '```',
  '',
  `TypeScript job: **${tsJob}** · Java job: **${javaJob}**`,
  '',
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
