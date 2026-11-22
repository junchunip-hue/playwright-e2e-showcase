// The navigation bar of the nightly's GitHub Pages site: one bar, the same on every page, so a reader can always go
// one level up (the back button) or jump to any level above (the breadcrumb), up to the project's README.
//
//   README (GitHub) › Nightly results (/) › TypeScript or Java report (/typescript/, /java/) › a test › its trace
//
// - Results page: built in by scripts/pages-site.mjs (navBar below).
// - Reports: injected after `playwright merge-reports` by this script as a CLI. The list shows "← Nightly results";
//   a test (#?testId=…) shows "← All tests", back to the list with its search kept. Playwright's own app is untouched.
// - Trace viewer (trace/index.html, opened from a test in the same tab): "← Back to the test" returns to that test.
//
// Links to the results page and the README are absolute, so a report opened from a run's artifact finds them too.
//
// Usage: node scripts/site-nav.mjs <report-dir> "<report name>"   e.g. playwright-report "TypeScript report"
// Idempotent: a page that already has the bar is left as it is.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoName = process.env.GITHUB_REPOSITORY || 'junchunip-hue/playwright-e2e-showcase';
const [owner, name] = repoName.split('/');
export const REPO = `https://github.com/${repoName}`;
export const SITE = `https://${owner}.github.io/${name}/`;
const README = `${REPO}#readme`;

const MARK = '<!-- site-nav -->';

export const NAV_CSS = `
#snav{--sn-bg:#f6f8fa;--sn-fg:#1f2328;--sn-muted:#59636e;--sn-line:#d1d9e0;--sn-link:#0969da;--sn-btn:#fff;
  display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;padding:7px 16px;background:var(--sn-bg);color:var(--sn-fg);
  border-bottom:1px solid var(--sn-line);font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;flex:none}
@media (prefers-color-scheme:dark){#snav{--sn-bg:#151b23;--sn-fg:#e6edf3;--sn-muted:#9198a1;--sn-line:#3d444d;--sn-link:#4493f8;--sn-btn:#0d1117}}
.light-mode #snav{--sn-bg:#f6f8fa;--sn-fg:#1f2328;--sn-muted:#59636e;--sn-line:#d1d9e0;--sn-link:#0969da;--sn-btn:#fff}
.dark-mode #snav{--sn-bg:#151b23;--sn-fg:#e6edf3;--sn-muted:#9198a1;--sn-line:#3d444d;--sn-link:#4493f8;--sn-btn:#0d1117}
#snav a{color:var(--sn-link);text-decoration:none}#snav a:hover{text-decoration:underline}
#snav .sn-back{padding:3px 10px;border:1px solid var(--sn-line);border-radius:6px;background:var(--sn-btn);color:var(--sn-fg);white-space:nowrap}
#snav .sn-back:hover{text-decoration:none;border-color:var(--sn-muted)}
#snav ol{display:flex;flex-wrap:wrap;margin:0;padding:0;list-style:none;color:var(--sn-muted);min-width:0}
#snav li+li::before{content:"›";margin:0 7px;color:var(--sn-muted)}#snav li[hidden]{display:none}
#snav [aria-current]{color:var(--sn-fg);font-weight:600}
#snav .sn-about{margin-left:auto;white-space:nowrap}`;

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// back: { href, label }; crumbs: [{ href?, label, id?, hidden? }], the last one is the current page.
// about: the "About the project" link on the right; the results page leaves it out, as its back button and first
// crumb already lead to the README and its intro line links it too.
export function navBar(back, crumbs, { about = true } = {}) {
  const items = crumbs.map((c, i) => {
    const attrs = `${c.id ? ` id="${c.id}"` : ''}${c.hidden ? ' hidden' : ''}`;
    const inner = c.href ? `<a href="${esc(c.href)}">${esc(c.label)}</a>` : esc(c.label);
    return `<li${attrs}${i === crumbs.length - 1 ? ' aria-current="page"' : ''}>${inner}</li>`;
  });
  return `<nav id="snav" aria-label="Site"><a class="sn-back" id="sn-back" href="${esc(back.href)}">← ${esc(back.label)}</a>
<ol>${items.join('')}</ol>${about ? `<a class="sn-about" href="${README}">About the project</a>` : ''}</nav>`;
}

// The results page's crumbs, the start of every report's.
const top = [
  { href: README, label: 'Project README' },
  { href: SITE, label: 'Nightly results' },
];

// Report list and test page: one bar, switched by the hash (Playwright's report routes with #?testId=…&q=…).
function reportNav(reportName) {
  return `${MARK}
<style>${NAV_CSS}</style>
${navBar({ href: SITE, label: 'Nightly results' }, [
  ...top,
  { href: '#?', label: reportName, id: 'sn-report' },
  { label: 'Test', id: 'sn-test', hidden: true },
])}
<script>
(() => {
  const back = document.getElementById('sn-back');
  const report = document.getElementById('sn-report');
  const test = document.getElementById('sn-test');
  const update = () => {
    const params = new URLSearchParams(location.hash.replace(/^#\\??/, ''));
    const list = params.get('q') ? '#?q=' + encodeURIComponent(params.get('q')) : '#?';
    report.querySelector('a').setAttribute('href', list);
    const onTest = params.has('testId');
    test.hidden = !onTest;
    (onTest ? test : report).setAttribute('aria-current', 'page');
    (onTest ? report : test).removeAttribute('aria-current');
    back.textContent = onTest ? '← All tests' : '← Nightly results';
    back.setAttribute('href', onTest ? list : ${JSON.stringify(SITE)});
  };
  addEventListener('hashchange', update);
  addEventListener('popstate', update);
  update();
})();
</script>`;
}

// Trace viewer: a full-height app with the body as a row flexbox; the bar goes above it as a column.
function traceNav(reportName) {
  return `${MARK}
<style>${NAV_CSS}
body{flex-direction:column}#root{flex:1 1 auto;min-height:0;height:auto}</style>
${navBar({ href: '../', label: 'Back to the test' }, [...top, { href: '../', label: reportName }, { label: 'Trace' }])}
<script>
(() => {
  // Opened from a test in the same tab: going back returns to that test (its #?testId=… is in the history).
  const back = document.getElementById('sn-back');
  const reportPath = location.pathname.replace(/trace\\/[^/]*$/, '');
  let fromReport = false;
  try { fromReport = !!document.referrer && new URL(document.referrer).pathname === reportPath; } catch {}
  if (fromReport && history.length > 1) back.addEventListener('click', (e) => { e.preventDefault(); history.back(); });
  else back.textContent = '← ' + ${JSON.stringify(reportName)};
})();
</script>`;
}

function inject(file, html) {
  const page = readFileSync(file, 'utf8');
  if (page.includes(MARK)) return console.log(`${file}: navigation already there`);
  const i = page.search(/<body[^>]*>/);
  if (i < 0) return console.warn(`${file}: no <body>, skipped`);
  const end = page.indexOf('>', i) + 1;
  writeFileSync(file, page.slice(0, end) + '\n' + html + page.slice(end));
  console.log(`${file}: navigation added`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [dir, reportName] = process.argv.slice(2);
  if (!dir || !reportName) {
    console.error('Usage: node scripts/site-nav.mjs <report-dir> "<report name>"');
    process.exit(2);
  }
  const index = join(dir, 'index.html');
  if (!existsSync(index)) console.warn(`${index}: no report, skipped`);
  else inject(index, reportNav(reportName));
  const trace = join(dir, 'trace', 'index.html');
  if (existsSync(trace)) inject(trace, traceNav(reportName));
}
