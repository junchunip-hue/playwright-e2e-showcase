// The Java results as a Playwright HTML report, in the same format as the TypeScript report.
//
// Cucumber-JVM has no Playwright reporter, so this script turns the Java scenario log (scenarios.jsonl, written by
// com.showcase.report.ScenarioLog: every attempt of every scenario, with its steps, hooks, durations and errors) into
// a Playwright blob report: the event stream Playwright's own reporters consume. `playwright merge-reports` then
// renders it with the standard HTML reporter, so the Java report has the same list, filters, search, step tree,
// errors and trace viewer as the TypeScript one:
//   - one test per scenario (Scenario Outline examples separately), grouped by feature file and Feature, with its
//     Gherkin tags as chips and project "api" (features/api, the API failure control C1) or "chromium" (everything else);
//   - every attempt as a result, so a scenario that passed on a CI rerun shows as flaky, as in TypeScript;
//   - "Before Hooks", each Gherkin step and "After Hooks" as top-level steps, with durations; the failed step carries
//     its error, and the steps after it are listed as skipped; the attempt's annotations name the failed step and list
//     the steps not run ("failed step", "not run"), as in TypeScript;
//   - inside each step what it did (com.showcase.report.ActionLog): browser actions, API requests and assertions, with
//     their target, duration, error and the line of Java code, which opens as a code snippet, as in TypeScript;
//   - an error with the line of Java code it came from and the code around it;
//   - the screenshot taken at the failed step (steps/Hooks.java, @AfterStep) attached to that step, like TypeScript;
//   - the Playwright trace of a failed scenario (java/target/playwright/<scenario>/trace.zip) as its trace attachment.
//
// Usage: node scripts/java-report.mjs <blob-out-dir> <surefire-dir>... [--traces <dir>]
//   then: npx playwright merge-reports --reporter html <blob-out-dir>
// The blob format is Playwright's (version 2, checked by merge-reports, which fails loudly on a mismatch).
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { crc32 } from 'node:zlib';

const args = process.argv.slice(2);
const tracesAt = args.indexOf('--traces');
const tracesDir = tracesAt >= 0 ? args.splice(tracesAt, 2)[1] : null;
const [outDir, ...logDirs] = args;
if (!outDir || !logDirs.length) {
  console.error('Usage: node scripts/java-report.mjs <blob-out-dir> <surefire-dir>... [--traces <dir>]');
  process.exit(2);
}

const ROOT = process.cwd();
// As in playwright.config.ts (testDir): paths in the report are relative to it, so Java code reads "../java/src/...",
// like "../src/..." in TypeScript. No feature file lies below it, so a Gherkin step shows no snippet of itself.
const REPORT_ROOT = join(ROOT, 'tests');
const require = createRequire(import.meta.url);
const PLAYWRIGHT = require('@playwright/test/package.json').version;
/** A Playwright selector as Java code, e.g. getByTestId("email"); the raw selector if Playwright's formatter moves. */
const locatorText = (selector) => {
  try {
    return require('playwright-core/lib/coreBundle').iso.asLocator('java', selector);
  } catch {
    return selector;
  }
};
const id = (...parts) => createHash('sha1').update(parts.join('\u0000')).digest('hex').slice(0, 32);
const CONTROL = /^C\d+:/;
const CONTROL_NOTE =
  'Fails on purpose every night to show how a failure is reported: the steps before the failing step passed, the ' +
  'failing step shows its error, and the steps after it are listed as skipped (not run). Not counted in the ' +
  'nightly verdict, the counts, the badge or the clean streak.';

/** Every attempt of every scenario, in the order they ran (a CI rerun appends its attempt). */
function attempts(dir) {
  const file = join(dir, 'scenarios.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter((l) => l.trim())
    .flatMap((l) => {
      try {
        return [{ ...JSON.parse(l), dir }];
      } catch {
        return []; // a line cut off by a crashed JVM
      }
    });
}

/** The Feature's title and line, read from the shared feature file (both languages run the same files). */
const features = new Map();
function feature(uri) {
  if (!features.has(uri)) {
    const text = existsSync(join(ROOT, uri)) ? readFileSync(join(ROOT, uri), 'utf8') : '';
    const lines = text.split('\n');
    const at = lines.findIndex((l) => /^\s*Feature:/.test(l));
    features.set(uri, {
      title: at >= 0 ? lines[at].replace(/^\s*Feature:\s*/, '').trim() : uri,
      line: at >= 0 ? at + 1 : 1,
    });
  }
  return features.get(uri);
}

// The same split as playwright.config.ts: API features and the API failure control (C1) in "api", the rest in chromium.
const projectOf = (uri) => (/^features\/(api\/|control\/api-)/.test(uri) ? 'api' : 'chromium');
const STATUS = { passed: 'passed', failed: 'failed', skipped: 'skipped' };
const statusOf = (s) => STATUS[s] ?? 'failed'; // pending, undefined, ambiguous: a failure

// Scenarios in run order, each with all its attempts.
const scenarios = new Map();
for (const dir of logDirs) {
  for (const a of attempts(dir)) {
    const key = `${a.uri}:${a.line}`;
    const sc = scenarios.get(key) ?? { uri: a.uri, line: a.line, name: a.name, tags: a.tags ?? [], attempts: [] };
    sc.attempts.push(a);
    scenarios.set(key, sc);
  }
}
for (const sc of scenarios.values()) sc.testId = id('java', sc.uri, String(sc.line), sc.name);

// --- the event stream -----------------------------------------------------------------------------------------------
const events = [];
const emit = (method, params) => events.push(params === undefined ? { method } : { method, params });
const resources = [];

emit('onBlobReportMetadata', {
  version: 2,
  userAgent: `Playwright/${PLAYWRIGHT} (Cucumber-JVM, converted by scripts/java-report.mjs)`,
  pathSeparator: '/',
});
emit('onConfigure', {
  config: {
    configFile: undefined,
    globalTimeout: 0,
    maxFailures: 0,
    metadata: {},
    rootDir: REPORT_ROOT,
    shard: null,
    version: PLAYWRIGHT,
    workers: 1,
    globalSetup: null,
    globalTeardown: null,
    tags: [],
    webServer: null,
    failOnFlakyTests: false,
  },
});

const byProject = new Map();
for (const sc of scenarios.values()) {
  const project = projectOf(sc.uri);
  const files = byProject.get(project) ?? new Map();
  files.set(sc.uri, [...(files.get(sc.uri) ?? []), sc]);
  byProject.set(project, files);
}
for (const [name, files] of byProject) {
  emit('onProject', {
    project: {
      metadata: {},
      name,
      outputDir: '',
      repeatEach: 1,
      retries: 0,
      testDir: ROOT,
      testIgnore: [],
      testMatch: [],
      timeout: 0,
      grep: [],
      grepInvert: [],
      dependencies: [],
      snapshotDir: '',
      use: {},
      suites: [...files].map(([uri, list]) => ({
        title: uri,
        location: { file: uri, line: 0, column: 0 },
        entries: [
          {
            title: feature(uri).title,
            location: { file: uri, line: feature(uri).line, column: 1 },
            entries: list.map((sc) => ({
              testId: sc.testId,
              title: sc.name,
              location: { file: uri, line: sc.line, column: 3 },
              retries: Math.max(sc.attempts.length - 1, 0),
              tags: sc.tags,
              repeatEachIndex: 0,
              annotations: [],
            })),
          },
        ],
      })),
    },
  });
}
emit('onBegin');

const sources = new Map();
/** The lines of a source file of this repository, or none. */
function source(file) {
  if (!sources.has(file)) {
    const path = join(ROOT, file);
    sources.set(file, existsSync(path) ? readFileSync(path, 'utf8').split(/\r?\n/) : []);
  }
  return sources.get(file);
}
/** Where a line of Java code is, at its first character. */
const codeLocation = ({ file, line }) => ({
  file: join(ROOT, file),
  line,
  column: (source(file)[line - 1] ?? '').search(/\S|$/) + 1,
});
/** The code around a line, as Playwright Test shows it below an error. */
function codeFrame({ file, line }) {
  const lines = source(file);
  const from = Math.max(line - 2, 1);
  const to = Math.min(line + 2, lines.length);
  const width = String(to).length;
  const shown = [];
  for (let n = from; n <= to; n++) {
    const text = lines[n - 1];
    shown.push(`${n === line ? '>' : ' '} ${String(n).padStart(width)} | ${text}`.trimEnd());
    if (n === line) shown.push(`  ${' '.repeat(width)} | ${' '.repeat(text.search(/\S|$/))}^`);
  }
  return `   at ../${file}:${line}\n\n${shown.join('\n')}`;
}
/** As in Playwright Test: the expected value green, the received one red, the call log dimmed. */
const green = (text) => `\u001b[32m${text}\u001b[39m`;
const red = (text) => `\u001b[31m${text}\u001b[39m`;
const dim = (text) => `\u001b[2m${text}\u001b[22m`;
function coloured(message) {
  const at = message.indexOf('Call log:\n');
  const head = at >= 0 ? message.slice(0, at) : message;
  const log = at >= 0 ? message.slice(at) : '';
  return (
    head
      .replace(/^(Expected[^:\n]*: *)(.+)$/gm, (_, label, value) => label + green(value))
      .replace(/^(Received[^:\n]*: *)(.+)$/gm, (_, label, value) => label + red(value))
      .replace(/expected: (<.*>) but was: (<.*>)$/gm, (_, a, b) => `expected: ${green(a)} but was: ${red(b)}`) +
    log.replace(/^(?!Call log:).+$/gm, (line) => dim(line))
  );
}
/** An error with the suite's lines it came from, innermost first (com.showcase.report.ActionLog). */
function error(message, frames = []) {
  const text = coloured(message);
  const stack = frames.map((f) => `\n    at ${f.function} (${join(ROOT, f.file)}:${f.line})`).join('');
  const top = frames.find((f) => source(f.file).length);
  return {
    message: text,
    stack: text + stack,
    ...(top ? { location: codeLocation(top), snippet: codeFrame(top) } : {}),
  };
}
/** When the last action in a list ended: a step lasts as long as what ran in it (the failure screenshot included). */
const endOf = (list = []) => Math.max(0, ...list.map((x) => (x.start ?? 0) + (x.duration ?? 0)));
let firstStart = Infinity;
let lastEnd = 0;
let anyFailed = false;

for (const sc of scenarios.values()) {
  const annotations = CONTROL.test(sc.name) ? [{ type: 'failure control', description: CONTROL_NOTE }] : [];
  sc.attempts.forEach((a, retry) => {
    const resultId = id(sc.testId, String(retry));
    let attachmentCount = 0; // a step refers to the result's attachments by index, in the order they were added
    const at = { testId: sc.testId, resultId };
    const start = a.start || Date.now();
    firstStart = Math.min(firstStart, start);
    lastEnd = Math.max(lastEnd, start + (a.duration ?? 0));
    emit('onTestBegin', {
      testId: sc.testId,
      result: { id: resultId, retry, workerIndex: 0, parallelIndex: 0, startTime: start },
    });

    // What a step did, nested as it ran.
    const actions = (list, parentStepId) => {
      for (const x of list ?? []) {
        const stepId = id(resultId, String(events.length));
        const subtitle = [x.selector && locatorText(x.selector), x.subtitle].filter(Boolean).join(' ');
        emit('onStepBegin', {
          ...at,
          step: {
            id: stepId,
            parentStepId,
            title: x.title,
            ...(subtitle ? { subtitle } : {}),
            category: x.category,
            startTime: x.start,
            location: { ...codeLocation(x), file: `../${x.file}` }, // relative to REPORT_ROOT, as in a blob report
          },
        });
        actions(x.actions, stepId);
        const end = { id: stepId, duration: x.duration ?? 0 };
        if (x.error) end.error = error(x.error);
        emit('onStepEnd', { ...at, step: end });
      }
    };
    let clock = start;
    const step = (s, parentStepId, title, category, location) => {
      const stepId = id(resultId, String(events.length));
      const startTime = s.start || clock;
      emit('onStepBegin', {
        ...at,
        step: { id: stepId, ...(parentStepId ? { parentStepId } : {}), title, category, startTime, location },
      });
      actions(s.actions, stepId);
      const duration = Math.max(s.duration ?? 0, endOf(s.actions) - startTime);
      const end = { id: stepId, duration };
      if (s.error) end.error = error(s.error, s.frames);
      if (s.status === 'skipped') end.annotations = [{ type: 'skip' }];
      // The failure screenshot (Hooks @AfterStep, saved by ScenarioLog): attached to this step, as in TypeScript.
      const files = (s.attachments ?? []).filter((x) => existsSync(join(a.dir, x.path)));
      for (const x of files) {
        const name = `resources/${id(a.dir, x.path)}${x.path.slice(x.path.lastIndexOf('.'))}`;
        resources.push([join(a.dir, x.path), name]);
        const attached = `${x.name}: ${title}`;
        const attachId = id(resultId, String(events.length));
        const last = endOf(s.actions) || startTime;
        emit('onStepBegin', {
          ...at,
          step: {
            id: attachId,
            parentStepId: stepId,
            title: `Attach ${JSON.stringify(attached)}`,
            category: 'test.attach',
            startTime: last,
          },
        });
        emit('onAttach', { ...at, attachments: [{ name: attached, path: name, contentType: x.contentType }] });
        emit('onStepEnd', { ...at, step: { id: attachId, duration: 0, attachments: [attachmentCount++] } });
      }
      emit('onStepEnd', { ...at, step: end });
      clock = startTime + duration;
      return stepId;
    };
    const hooks = (kind, title) => {
      const list = (a.steps ?? []).filter((s) => s.hook === kind);
      if (!list.length) return;
      const groupId = id(resultId, kind);
      const groupStart = list[0].start || clock;
      emit('onStepBegin', { ...at, step: { id: groupId, title, category: 'hook', startTime: groupStart } });
      for (const h of list) step(h, groupId, h.text, 'hook');
      const failed = list.find((h) => h.error);
      emit('onStepEnd', {
        ...at,
        step: {
          id: groupId,
          duration: clock - groupStart,
          ...(failed ? { error: error(failed.error, failed.frames) } : {}),
        },
      });
    };

    hooks('before', 'Before Hooks');
    for (const s of (a.steps ?? []).filter((x) => !x.hook)) {
      step(s, undefined, s.text, 'test.step', { file: sc.uri, line: s.line, column: 5 });
    }
    hooks('after', 'After Hooks');

    const status = statusOf(a.status);
    const last = retry === sc.attempts.length - 1;
    if (last && status === 'failed') {
      anyFailed = true;
      const slug = sc.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      // API scenarios use no page (TypeScript keeps no trace for them either): only browser scenarios get one.
      const trace = tracesDir && projectOf(sc.uri) === 'chromium' && join(tracesDir, slug, 'trace.zip');
      if (trace && existsSync(trace)) {
        const name = `resources/${id(trace)}.zip`;
        resources.push([trace, name]);
        emit('onAttach', { ...at, attachments: [{ name: 'trace', path: name, contentType: 'application/zip' }] });
        attachmentCount++;
      }
    }
    // As in TypeScript (src/steps/not-run.hooks.ts): a failed Gherkin step is named, and the steps after it listed
    // as not run, in the attempt's annotations (a failed hook shows in its group instead).
    const gherkin = (a.steps ?? []).filter((x) => !x.hook);
    const failedAt = gherkin.findIndex((x) => x.status === 'failed');
    const notRun = failedAt >= 0 ? gherkin.slice(failedAt + 1).map((x) => x.text) : [];
    const attemptAnnotations = [
      ...annotations,
      ...(failedAt >= 0 ? [{ type: 'failed step', description: gherkin[failedAt].text }] : []),
      ...(notRun.length ? [{ type: 'not run', description: notRun.join('\n') }] : []),
    ];
    emit('onTestEnd', {
      test: { testId: sc.testId, expectedStatus: 'passed', timeout: 0, annotations: attemptAnnotations },
      result: {
        id: resultId,
        duration: a.duration ?? 0,
        status,
        errors: status === 'failed' && a.error ? [error(a.error, a.frames)] : [],
        annotations: attemptAnnotations,
      },
    });
  });
}
emit('onEnd', {
  result: {
    status: anyFailed ? 'failed' : 'passed',
    startTime: Number.isFinite(firstStart) ? firstStart : Date.now(),
    duration: Number.isFinite(firstStart) ? lastEnd - firstStart : 0,
  },
});

// --- a stored (uncompressed) zip: report.jsonl and the trace attachments, as merge-reports expects -------------------
function zip(entries) {
  const locals = [];
  const central = [];
  let offset = 0;
  for (const [name, data] of entries) {
    const n = Buffer.from(name);
    const crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    locals.push(local, n, data);
    const dir = Buffer.alloc(46);
    dir.writeUInt32LE(0x02014b50, 0);
    dir.writeUInt16LE(20, 4);
    dir.writeUInt16LE(20, 6);
    dir.writeUInt16LE(0x0800, 8);
    dir.writeUInt32LE(crc, 16);
    dir.writeUInt32LE(data.length, 20);
    dir.writeUInt32LE(data.length, 24);
    dir.writeUInt16LE(n.length, 28);
    dir.writeUInt32LE(offset, 42);
    central.push(dir, n);
    offset += 30 + n.length + data.length;
  }
  const size = central.reduce((s, b) => s + b.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(size, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

mkdirSync(outDir, { recursive: true });
const entries = [
  ['report.jsonl', Buffer.from(events.map((e) => JSON.stringify(e)).join('\n') + '\n')],
  ...resources.map(([from, name]) => [name, readFileSync(from)]),
];
writeFileSync(join(outDir, 'report-java.zip'), zip(entries));
console.log(
  `Java blob report: ${scenarios.size} scenarios, ${[...scenarios.values()].reduce((n, s) => n + s.attempts.length, 0)} attempts, ` +
    `${resources.length} trace(s) → ${resolve(outDir, 'report-java.zip')}`,
);
