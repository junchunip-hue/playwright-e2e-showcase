// Cross-platform `SUITE=<name> playwright test [args]` for npm scripts (Windows shells cannot set env inline).
// Suites are defined in src/tags.ts; an unknown name fails in playwright.config.ts with the list of known suites.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const [suite, ...args] = process.argv.slice(2);
if (!suite) {
  console.error('Usage: node scripts/run-suite.mjs <suite> [playwright test args...]');
  process.exit(2);
}

const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
const { status } = spawnSync(process.execPath, [cli, 'test', ...args], {
  stdio: 'inherit',
  env: { ...process.env, SUITE: suite },
});
process.exit(status ?? 1);
