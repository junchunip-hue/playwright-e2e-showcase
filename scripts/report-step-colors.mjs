// Colours the steps of a Playwright HTML report (the TypeScript and the Java one alike) by their result, so the step
// tree reads at a glance: every step title in bold, a passed step in the green of its ✓, a failed one in the red of
// its ✗, and a step that did not run (skipped, ⊘) in a gray that stays readable. It applies to every step in the
// "Test Steps" tree, from "Before Hooks" to "After Hooks" and "Worker Cleanup", nested steps included.
//
// CSS only: the step's own status icon carries Playwright's colour class (color-icon-success, color-text-danger,
// color-fg-muted), and :has() styles the title next to it, so it follows Playwright's re-renders and its light/dark
// theme variables without any script. The file location after a step ("— features/…:9") keeps its normal style.
//
// Usage: node scripts/report-step-colors.mjs <report-dir>...   (after `playwright merge-reports --reporter html`)
// Idempotent: a report that already has the colours is left as it is.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const MARK = '<!-- report-step-colors -->';

const STYLE = `${MARK}
<style>
.step-title-container > .step-title-text > span:first-child{font-weight:600}
.step-title-container:has(> svg.color-icon-success) > .step-title-text > span:first-child{color:var(--color-success-fg)}
.step-title-container:has(> svg.color-text-danger) > .step-title-text > span:first-child{color:var(--color-danger-fg)}
/* Skipped (not run): Playwright's muted gray is 6:1 or more against its background in both themes, so it stays readable. */
.step-title-container:has(> svg.color-fg-muted) > .step-title-text > span:first-child{color:var(--color-fg-muted)}
</style>`;

const dirs = process.argv.slice(2);
if (!dirs.length) {
  console.error('Usage: node scripts/report-step-colors.mjs <report-dir>...');
  process.exit(2);
}
for (const dir of dirs) {
  const file = join(dir, 'index.html');
  if (!existsSync(file)) {
    console.warn(`${file}: no report, skipped`);
    continue;
  }
  const html = readFileSync(file, 'utf8');
  if (html.includes(MARK)) {
    console.log(`${file}: step colours already there`);
    continue;
  }
  const at = html.indexOf('</head>');
  writeFileSync(file, at >= 0 ? html.slice(0, at) + STYLE + html.slice(at) : STYLE + html);
  console.log(`${file}: step colours added`);
}
