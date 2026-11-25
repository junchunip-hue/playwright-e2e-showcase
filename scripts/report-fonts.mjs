// Readable fonts for every page of the results site: both Playwright HTML reports, their trace viewers, and (imported by
// site-nav.mjs and pages-site.mjs) the navigation bar and the results page.
//
// Why: Playwright's report asks for plain `monospace` in errors and code, and its trace viewer for `system-ui`. The
// browser then picks the system's default, which on a Korean, Japanese or Chinese system is an East Asian font whose
// Latin letters are thin and hard to read. These stacks name a good Latin font for each system first (Windows, macOS,
// Linux). They are installed fonts: nothing is downloaded, and no font file is shipped.
//
// Usage: node scripts/report-fonts.mjs <report-dir>...   (after `playwright merge-reports --reporter html`)
// Idempotent: a page that already has the fonts is left as it is.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const TEXT_FONT =
  '"Segoe UI Variable Text","Segoe UI",-apple-system,BlinkMacSystemFont,Roboto,"Noto Sans",Ubuntu,"Helvetica Neue",Arial,sans-serif';
export const CODE_FONT =
  '"Cascadia Mono",Consolas,"SF Mono",SFMono-Regular,Menlo,"Roboto Mono","DejaVu Sans Mono","Liberation Mono","Ubuntu Mono","Courier New",monospace';

const MARK = '<!-- report-fonts -->';

// The variables are the trace viewer's (and the report's) own; ligatures stay off, so code reads character by character.
const STYLE = `${MARK}
<style>
:root{--vscode-font-family:${TEXT_FONT}!important;--vscode-editor-font-family:${CODE_FONT}!important}
html,body,#root,.htmlreport{font-family:${TEXT_FONT}!important}
button,input,select,textarea{font-family:inherit}
.test-error-view,.test-error-container,.test-error-text,.attachment-body,pre,code,kbd,samp{
  font-family:${CODE_FONT}!important;font-variant-ligatures:none}
.test-error-view,.test-error-container,.test-error-text,.attachment-body{font-size:13px!important;line-height:1.55!important}
</style>`;

function inject(file) {
  const html = readFileSync(file, 'utf8');
  if (html.includes(MARK)) return console.log(`${file}: fonts already there`);
  const at = html.indexOf('</head>');
  writeFileSync(file, at >= 0 ? html.slice(0, at) + STYLE + html.slice(at) : STYLE + html);
  console.log(`${file}: fonts added`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const dirs = process.argv.slice(2);
  if (!dirs.length) {
    console.error('Usage: node scripts/report-fonts.mjs <report-dir>...');
    process.exit(2);
  }
  for (const dir of dirs) {
    const index = join(dir, 'index.html');
    if (existsSync(index)) inject(index);
    else console.warn(`${index}: no report, skipped`);
    const trace = join(dir, 'trace', 'index.html');
    if (existsSync(trace)) inject(trace);
  }
}
