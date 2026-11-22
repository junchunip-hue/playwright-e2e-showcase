// `npm run demo [-- <ID>]`: one scenario, live, for a presentation. Generates the Gherkin tests (bddgen), then runs
// the scenario with that test-plan ID (default U6, the first purchase) in a visible Chromium window, slowed down so
// the audience can follow, and keeps its trace (`npm run report`, then open the trace). An API scenario has no page
// and, as in Java, no trace: its steps and error are in the report. Java: see docs/java.md.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const id = process.argv[2] ?? 'U6';
if (!/^[ASUC]\d+$/.test(id)) {
  console.error(`Usage: npm run demo [-- <scenario ID, e.g. U6, S2, A8, or C1 / C2 for a failure>] (got "${id}")`);
  process.exit(2);
}

const require = createRequire(import.meta.url);
// The package exports only its package.json, not the CLI file: find the CLI through the declared "bin".
const bddPackage = require.resolve('playwright-bdd/package.json');
const bddCli = join(dirname(bddPackage), require(bddPackage).bin.bddgen);
const bddgen = spawnSync(process.execPath, [bddCli], { stdio: 'inherit' });
if (bddgen.status !== 0) process.exit(bddgen.status ?? 1);

// API scenarios have no browser: they run in the api project, with their steps in the report. The failure controls
// are left out of every suite but `control`, so a C ID selects that suite and both projects: C1 (API) runs in api,
// C2 (UI) in Chromium, and the grep picks the one asked for.
const projects = id.startsWith('A') ? ['api'] : id.startsWith('C') ? ['api', 'chromium'] : ['chromium'];
const suite = id.startsWith('C') ? { SUITE: 'control' } : {};
const cli = require.resolve('@playwright/test/cli');
const { status } = spawnSync(
  process.execPath,
  [cli, 'test', ...projects.map((p) => `--project=${p}`), '--grep', `${id}: `, '--headed', '--workers=1'],
  // DEMO=1 keeps every trace (playwright.config.ts); not --trace=on, which would also trace the api project.
  { stdio: 'inherit', env: { ...process.env, ...suite, DEMO: '1', SLOW_MO: process.env.SLOW_MO ?? '400' } },
);
process.exit(status ?? 1);
