// Keeps the history of nightly verdicts on master and the "clean nightlies in a row" count (roadmap §5: five in a row).
// Runs in the nightly summary job on master; the files are published with the report on GitHub Pages, and the next run
// reads them back from there.
// Usage: node scripts/nightly-history.mjs <previous-history.json> <seed.json> <out-dir>
//   env: VERDICT (passed | flaky | rerun | failed | unverified, from pipeline-summary.mjs), RUN_NUMBER, RUN_ID, SHA
//   Writes <out-dir>/history.json and <out-dir>/streak.json (a shields.io endpoint badge).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const [previousFile, seedFile, outDir] = process.argv.slice(2);
const { VERDICT, RUN_NUMBER, RUN_ID, SHA } = process.env;
const KEEP = 90; // about three months of nightlies
const TARGET = 5;

const read = (file) => {
  try {
    return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : null;
  } catch {
    return null; // a broken file must not stop the report from publishing
  }
};

// The published history wins; the seed (runs before the history existed) is only used once.
const history = read(previousFile) ?? read(seedFile) ?? [];
if (VERDICT && VERDICT !== 'none' && !history.some((r) => String(r.id) === String(RUN_ID))) {
  history.push({
    run: Number(RUN_NUMBER),
    id: Number(RUN_ID),
    sha: (SHA ?? '').slice(0, 7),
    date: new Date().toISOString().slice(0, 10),
    verdict: VERDICT,
  });
}
const kept = history.slice(-KEEP);

// Clean = passed, nothing flaky, failed, unverified or passed only on a rerun. The streak counts back from the latest run.
let streak = 0;
for (let i = kept.length - 1; i >= 0 && kept[i].verdict === 'passed'; i--) streak++;

const badge = {
  schemaVersion: 1,
  label: 'clean nightlies',
  message: `${streak} in a row${streak >= TARGET ? '' : ` (goal ${TARGET})`}`,
  color: streak >= TARGET ? 'brightgreen' : streak > 0 ? 'yellow' : 'red',
};
writeFileSync(join(outDir, 'history.json'), `${JSON.stringify(kept, null, 2)}\n`);
writeFileSync(join(outDir, 'streak.json'), `${JSON.stringify(badge)}\n`);
console.log(`${kept.length} nightlies in the history, ${streak} clean in a row: ${badge.message}`);
