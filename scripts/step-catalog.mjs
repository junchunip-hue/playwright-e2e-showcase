// The step catalogue: every Gherkin step, grouped by the page or API it acts on, with the features that use it and
// its TypeScript and Java definitions (docs/coding-rules.md#gherkin-steps).
//   npm run steps          rewrites docs/steps.md
//   npm run check:steps    fails if docs/steps.md is out of date, a step is unused, or a step exists in only one
//                          language. CI and the pre-push hook run it.
// Read docs/steps.md before writing a new step: if the action already exists, reuse its sentence.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const OUT = 'docs/steps.md';
const check = process.argv.includes('--check');

const files = (dir, ext) =>
  readdirSync(dir, { recursive: true })
    .map((f) => join(dir, f))
    .filter((f) => f.endsWith(ext))
    .sort();
const rel = (f) => relative(ROOT, f).replaceAll('\\', '/');
const lineOf = (src, index) => src.slice(0, index).split('\n').length;

// Where a step acts, from the fixtures it takes. The first match wins, so a page beats the API it also reads.
const AREAS = [
  ['loginPage', 'Login page'],
  ['homePage', 'Catalogue page (home)'],
  ['productPage', 'Product page'],
  ['comparisonPage', 'Comparison page'],
  ['favoritesPage', 'Favourites page'],
  ['checkoutPage', 'Checkout'],
  ['accountPage', 'Account pages'],
  ['invoicesPage', 'Account pages'],
  ['invoiceDetailsPage', 'Account pages'],
  ['contactPage', 'Contact page'],
  ['header', 'Header (on every page)'],
  ['network', 'Network: mocked API answers'],
  ['page', 'Browser (URL, downloads)'],
  ['adminToken', 'API as admin'],
  ['api', 'API'],
];
const NO_FIXTURE = 'Scenario data: checks on what earlier steps captured';
const AREA_ORDER = [...new Set([...AREAS.map(([, a]) => a), NO_FIXTURE])];

// TypeScript: Given('text', async ({ fixtures }, ...) => ...) or Given(/regex/, ...), possibly over several lines.
const TS_STEP =
  /^(Given|When|Then)\(\s*(?:(['"`])((?:\\.|(?!\2).)*)\2|\/((?:\\.|[^/])+)\/)\s*,\s*async\s*\(\s*\{([^}]*)\}/gms;
const steps = new Map();
for (const file of files('src/steps', '.steps.ts')) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(TS_STEP)) {
    const text = m[3] !== undefined ? m[3].replace(/\\(.)/g, '$1') : `^${m[4].replace(/^\^|\$$/g, '')}$`;
    const fixtures = m[5].split(',').map((s) => s.trim().split(':')[0]);
    // A step with no page or API fixture checks what earlier steps stored; in src/steps/api/ that is an API answer.
    const area =
      AREAS.find(([f]) => fixtures.includes(f))?.[1] ?? (rel(file).startsWith('src/steps/api/') ? 'API' : NO_FIXTURE);
    steps.set(text, {
      keyword: m[1],
      text,
      regex: m[4] !== undefined,
      area,
      ts: `${rel(file)}:${lineOf(src, m.index)}`,
    });
  }
}

// Java: @Given("text") on the step method.
const JAVA_STEP = /@(Given|When|Then)\(\s*"((?:\\.|[^"\\])*)"\s*\)/g;
const javaOnly = [];
for (const file of files('java/src/test/java/com/showcase/steps', '.java')) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(JAVA_STEP)) {
    const text = m[2].replace(/\\\\/g, '\\').replace(/\\"/g, '"');
    const step = steps.get(text);
    if (step) step.java = `${rel(file)}:${lineOf(src, m.index)}`;
    else javaOnly.push(`${text} (${rel(file)}:${lineOf(src, m.index)})`);
  }
}

// Which features use each step: the Cucumber expression or regex matched against every step line.
const toRegex = (step) => {
  if (step.regex) return new RegExp(step.text);
  const body = step.text
    .split(/(\{string\}|\{int\})/)
    .map((p) => (p === '{string}' ? '"[^"]*"' : p === '{int}' ? '-?\\d+' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    .join('');
  return new RegExp(`^${body}$`);
};
const STEP_LINE = /^\s*(?:Given|When|Then|And|But|\*)\s+(.+?)\s*$/;
const cells = (line) =>
  line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());
// Step lines of a feature, with Scenario Outline steps expanded once per Examples row.
function stepTexts(src) {
  const texts = [];
  let outline = [];
  let header = null;
  let inExamples = false;
  for (const line of src.split('\n')) {
    const t = line.trim();
    if (/^(Scenario|Background|Rule|Feature)/.test(t)) [outline, inExamples, header] = [[], false, null];
    if (/^Examples:/.test(t)) [inExamples, header] = [true, null];
    const step = line.match(STEP_LINE)?.[1];
    if (step && !t.startsWith('|')) {
      if (step.includes('<')) outline.push(step);
      else texts.push(step);
    } else if (inExamples && t.startsWith('|')) {
      if (!header) header = cells(t);
      else {
        const row = cells(t);
        texts.push(...outline.map((s) => header.reduce((acc, h, i) => acc.replaceAll(`<${h}>`, row[i]), s)));
      }
    }
  }
  return texts;
}
const featureLines = files('features', '.feature').flatMap((f) =>
  stepTexts(readFileSync(f, 'utf8')).map((text) => ({ file: rel(f).replace(/^features\//, ''), text })),
);
for (const step of steps.values()) {
  const re = toRegex(step);
  step.features = [...new Set(featureLines.filter((l) => re.test(l.text)).map((l) => l.file))];
}

// docs/steps.md
const all = [...steps.values()];
const esc = (s) => s.replaceAll('|', '\\|');
const link = (loc) => {
  const [path, line] = loc.split(':');
  return `[${path.split('/').pop()}:${line}](../${path}#L${line})`;
};
const out = [
  '# Step catalogue',
  '',
  '<!-- Generated by `npm run steps` (scripts/step-catalog.mjs). Do not edit by hand: CI fails when it is out of date. -->',
  '',
  'Every Gherkin step of the suite, grouped by **where it acts**: the page, the header, the mocked network or the API.',
  'Before you write a new step, look in the section of the page you work on. If the action is already there, reuse that',
  'sentence. If it is not, write it so it names the page or API it acts on. The rules are in',
  '[coding-rules.md](coding-rules.md#gherkin-steps).',
  '',
  `${all.length} steps, each defined once in TypeScript and once in Java.`,
  '',
];
for (const area of AREA_ORDER) {
  const rows = all.filter((s) => s.area === area).sort((a, b) => a.text.localeCompare(b.text));
  if (!rows.length) continue;
  out.push(`## ${area}`, '', '| Step | Used in | TypeScript | Java |', '|---|---|---|---|');
  for (const s of rows) {
    const text = s.regex ? `\`${esc(s.text)}\`` : esc(s.text);
    out.push(
      `| ${s.keyword} ${text} | ${s.features.join(', ') || '–'} | ${link(s.ts)} | ${s.java ? link(s.java) : '–'} |`,
    );
  }
  out.push('');
}
const catalogue = out.join('\n');

const problems = [
  ...all.filter((s) => !s.features.length).map((s) => `unused step: "${s.text}" (${s.ts})`),
  ...all.filter((s) => !s.java).map((s) => `no Java twin: "${s.text}" (${s.ts})`),
  ...javaOnly.map((s) => `no TypeScript twin: ${s}`),
];
if (check) {
  let current = '';
  try {
    current = readFileSync(OUT, 'utf8');
  } catch {
    /* missing counts as out of date */
  }
  if (current.replaceAll('\r\n', '\n') !== catalogue) problems.push(`${OUT} is out of date: run "npm run steps"`);
} else {
  writeFileSync(OUT, catalogue);
  console.log(`${OUT}: ${all.length} steps`);
}
if (problems.length) {
  console.error(`✖ Step check failed:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
if (check) console.log(`✔ ${all.length} steps: catalogue up to date, all used, all in both languages.`);
