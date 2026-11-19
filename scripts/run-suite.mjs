// Cross-platform `SUITE=<name> playwright test [args]` for npm scripts (Windows shells cannot set env inline),
// after `bddgen` has turned the Gherkin features into Playwright tests.
// Suites are defined in src/tags.ts; an unknown name fails in playwright.config.ts with the list of known suites.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const [suite, ...args] = process.argv.slice(2);
if (!suite) {
  console.error('Usage: node scripts/run-suite.mjs <suite> [playwright test args...]');
  process.exit(2);
}

const require = createRequire(import.meta.url);
// Gherkin features are generated into Playwright tests first (playwright-bdd); see playwright.config.ts.
// The package exports only its package.json, not the CLI file: find the CLI through the declared "bin".
const bddPackage = require.resolve('playwright-bdd/package.json');
const bddCli = join(dirname(bddPackage), require(bddPackage).bin.bddgen);
const bddgen = spawnSync(process.execPath, [bddCli], { stdio: 'inherit' });
if (bddgen.status !== 0) process.exit(bddgen.status ?? 1);

const cli = require.resolve('@playwright/test/cli');
const { status } = spawnSync(process.execPath, [cli, 'test', ...args], {
  stdio: 'inherit',
  env: { ...process.env, SUITE: suite },
});
process.exit(status ?? 1);
