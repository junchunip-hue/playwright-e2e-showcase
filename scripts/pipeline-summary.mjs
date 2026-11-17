// Writes the PR pipeline summary (GitHub job summary): a diagram of the run and a TypeScript-vs-Java table
// per test ID. Inputs: Playwright JSON results, Surefire XML reports and the job results from `needs`.
// Usage: node scripts/pipeline-summary.mjs <ts-results.json> <surefire-dir>   (env: TS_JOB, JAVA_JOB)
import { appendFileSync, existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const [tsFile, javaDir] = process.argv.slice(2);
const ID = /\b([ASUN]\d+):/;
const ORDER = 'SUAN';

/** id → { passed, failed, flaky, skipped } */
const tally = () => ({ passed: 0, failed: 0, flaky: 0, skipped: 0 });

function typescriptResults(file) {
  const byId = new Map();
  if (!file || !existsSync(file)) return byId;
  const walk = (suite) => {
    for (const spec of suite.specs ?? []) {
      const id = ID.exec(spec.title)?.[1];
      if (!id) continue;
      for (const t of spec.tests ?? []) {
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
  ...ids.map((id) => `| ${id} | ${cell(ts.get(id))} | ${cell(java.get(id))} | ${coverage(id)} |`),
  '',
  'Every A, U and S ID must show results in both columns (same tier, so same pipeline); N IDs are TypeScript-only (ADR 0009).',
  '',
].join('\n');

if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
else process.stdout.write(md);
