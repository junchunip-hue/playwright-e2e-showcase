// The code model behind the PR impact comments (scripts/pr-impact.mjs): the features as scenarios and steps, and the
// TypeScript and Java test code as units (step definitions, class members, top-level functions and constants,
// fixtures, spec tests) with the names each unit uses. A changed line belongs to a unit; a unit affects every unit
// that uses it, up to the step definitions, and a step definition affects every scenario step its sentence matches.
//
// "Uses" is decided by names, made precise by types where the code says them: `checkoutPage.pay(` in a step whose
// fixture checkoutPage is a CheckoutPage uses CheckoutPage.pay, not LoginPage.pay; `this.ui.finish` in a page uses
// its module's finish. When a receiver's type is unknown, a member name used on a class the file can reach (by import
// in TypeScript, by name in Java) counts: the analysis may list a scenario too many, never one too few.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { posix } from 'node:path';

export const git = (...args) =>
  execFileSync('git', args, { encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] });

/** A file's text at a revision, or in the working tree when rev is null; null if it does not exist there. */
export function readAt(rev, path) {
  try {
    return rev ? git('show', `${rev}:${path}`) : existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

/** Every tracked file of the working tree, or of a revision. */
export function listFiles(rev) {
  const out = rev ? git('ls-tree', '-r', '--name-only', rev) : git('ls-files');
  return out.split('\n').filter(Boolean);
}

// Blank lines, comments and import/package lines do not change what a test does.
const isNoise = (line) => /^\s*($|\/\/|\/\*|\*|#(?!\{)|import\s|package\s)/.test(line);

/**
 * The changed lines of each file between base and the working tree, comment-only and blank lines left out:
 * { path, oldPath, status, added: Set<head line>, removed: Set<base line> }.
 */
export function changedFiles(base) {
  const diff = git('diff', '--no-color', '--unified=0', '--find-renames', base);
  const files = [];
  let cur = null;
  let oldLine = 0;
  let newLine = 0;
  for (const line of diff.split('\n')) {
    if (line.startsWith('diff --git ')) {
      cur = { path: null, oldPath: null, status: 'modified', added: new Set(), removed: new Set() };
      files.push(cur);
    } else if (!cur) continue;
    else if (line.startsWith('--- ')) cur.oldPath = line === '--- /dev/null' ? null : line.slice(6);
    else if (line.startsWith('+++ ')) cur.path = line === '+++ /dev/null' ? null : line.slice(6);
    else if (line.startsWith('new file')) cur.status = 'added';
    else if (line.startsWith('deleted file')) cur.status = 'deleted';
    else if (line.startsWith('rename from')) cur.status = 'renamed';
    else if (line.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
      oldLine = Number(m[1]);
      newLine = Number(m[2]);
    } else if (line.startsWith('+') && !line.startsWith('+++')) {
      if (!isNoise(line.slice(1))) cur.added.add(newLine);
      newLine++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      if (!isNoise(line.slice(1))) cur.removed.add(oldLine);
      oldLine++;
    }
  }
  for (const f of files) f.path ??= f.oldPath;
  return files.filter((f) => f.path);
}

// --- Features ---------------------------------------------------------------------------------------------------

const STEP_LINE = /^\s*(Given|When|Then|And|But|\*)\s+(.+?)\s*$/;
const cells = (line) =>
  line
    .trim()
    .slice(1, -1)
    .split('|')
    .map((c) => c.trim());

/**
 * A feature file as { file, header: [start, end], scenarios: [{ id, title, start, end, tags, steps }] }; a step is
 * { line, text, texts } where texts are the sentences it runs (one per Examples row in a Scenario Outline).
 * Background steps are part of every scenario of the file.
 */
export function parseFeature(file, src) {
  const lines = src.split('\n');
  const feature = { file, header: [1, lines.length], tags: [], scenarios: [] };
  let tags = [];
  let tagStart = null;
  let block = null;
  let background = [];
  let examplesHeader = null;
  let inExamples = false;
  const close = (end) => {
    if (block) block.end = end;
  };
  lines.forEach((raw, i) => {
    const n = i + 1;
    const t = raw.trim();
    if (t.startsWith('@')) {
      if (tagStart === null) tagStart = n;
      tags.push(...t.split(/\s+/).filter((x) => x.startsWith('@')));
      return;
    }
    const head = /^(Feature|Background|Scenario Outline|Scenario Template|Scenario|Example|Rule):\s*(.*)$/.exec(t);
    if (head) {
      const start = tagStart ?? n;
      if (head[1] === 'Feature') feature.tags = tags;
      else {
        if (feature.scenarios.length === 0 && !block) feature.header = [1, start - 1];
        close(start - 1);
        if (head[1] === 'Background') {
          block = { background: true, steps: background, start };
        } else if (head[1] !== 'Rule') {
          const title = head[2];
          block = {
            id: /^([A-Z]\d+):/.exec(title)?.[1] ?? '–',
            title,
            line: n,
            start,
            tags: [...feature.tags, ...tags],
            steps: [],
            outline: [],
          };
          feature.scenarios.push(block);
        }
      }
      [tags, tagStart, inExamples, examplesHeader] = [[], null, false, null];
      return;
    }
    tags = [];
    tagStart = null;
    if (!block) return;
    if (/^Examples:/.test(t)) {
      [inExamples, examplesHeader] = [true, null];
      return;
    }
    const step = raw.match(STEP_LINE);
    if (step && !t.startsWith('|')) {
      const entry = { line: n, keyword: step[1], text: step[2], texts: step[2].includes('<') ? [] : [step[2]] };
      block.steps.push(entry);
      if (step[2].includes('<')) block.outline?.push(entry);
    } else if (inExamples && t.startsWith('|') && block.outline) {
      if (!examplesHeader) examplesHeader = cells(t);
      else {
        const row = cells(t);
        for (const s of block.outline)
          s.texts.push(examplesHeader.reduce((acc, h, k) => acc.replaceAll(`<${h}>`, row[k]), s.text));
        block.examples = (block.examples ?? 0) + 1;
      }
    }
  });
  close(lines.length);
  for (const sc of feature.scenarios) sc.steps = [...background.map((s) => ({ ...s, background: true })), ...sc.steps];
  return feature;
}

/** A Cucumber expression ({string}, {int}) or a regex step text as a RegExp for whole sentences. */
export function stepRegex(text, isRegex) {
  if (isRegex) return new RegExp(text);
  const body = text
    .split(/(\{string\}|\{int\}|\{word\}|\{float\})/)
    .map((p) =>
      p === '{string}'
        ? '"[^"]*"'
        : p === '{int}'
          ? '-?\\d+'
          : p === '{float}'
            ? '-?\\d+(?:\\.\\d+)?'
            : p === '{word}'
              ? '\\S+'
              : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    )
    .join('');
  return new RegExp(`^${body}$`);
}

// --- Code units ---------------------------------------------------------------------------------------------------

const IDENT = /[A-Za-z_$][\w$]*/g;
/**
 * The member chains a body uses, as arrays: `checkoutPage.ui.signIn.email.fill(x)` → ['checkoutPage','ui','signIn',
 * 'email','fill']; a call between members (Java `checkoutPage().pay()`) does not break the chain. Arguments are
 * read too, innermost first, so chains inside calls are found.
 */
const CHAIN =
  /(?<![\w$.])([A-Za-z_$][\w$]*)((?:\s*(?:\(\s*\)|\u0001))?(?:\s*\??\.\s*[A-Za-z_$][\w$]*(?:\s*(?:\(\s*\)|\u0001))?)+)/g;
function chainsOf(body) {
  const chains = [];
  let text = body.replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
  // Each pass reads the chains, then replaces the innermost argument lists with a call mark: `a.b(x.y).c` gives
  // x.y on the first pass and a.b.c on the second.
  for (let pass = 0; pass < 16; pass++) {
    for (const m of text.matchAll(CHAIN)) chains.push([m[1], ...(m[2].match(/[A-Za-z_$][\w$]*/g) ?? [])]);
    const next = text.replace(/\(([^()]*)\)/g, '\u0001');
    if (next === text) break;
    text = next;
  }
  return chains;
}

function finishUnit(u, lines) {
  u.body = lines.slice(u.start - 1, u.end).join('\n');
  // Names in strings and comments are not uses: '/users/register' does not call register().
  const code = u.body
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/(["'`])(?:\\.|(?!\1)[^\\\n])*\1/g, '""');
  u.tokens = new Set(code.match(IDENT) ?? []);
  u.chains = chainsOf(u.body);
  return u;
}

const tsResolve = (from, spec) => {
  const p = posix.normalize(posix.join(posix.dirname(from), spec));
  for (const c of [`${p}.ts`, `${p}/index.ts`, `${p}.mjs`, p]) if (existsSync(c) && statSync(c).isFile()) return c;
  return `${p}.ts`;
};

/** TypeScript: imports, top-level statements, class and object members, step definitions, hooks, spec tests. */
function parseTs(file, src) {
  const lines = src.split('\n');
  const units = [];
  const imports = new Set();
  // Import statements, also those over several lines: a change there alone changes no behaviour.
  const importLines = new Set();
  const lineAt = (index) => src.slice(0, index).split('\n').length;
  for (const m of src.matchAll(/^(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"];?/gms)) {
    if (m[1].startsWith('.')) imports.add(tsResolve(file, m[1]));
    for (let n = lineAt(m.index); n <= lineAt(m.index + m[0].length); n++) importLines.add(n);
  }
  const isSpec = /^tests\/.*\.(spec|setup)\.ts$/.test(file);
  const starts = [];
  lines.forEach((l, i) => {
    if (
      /^\S/.test(l) &&
      !/^(\}|\)|\]|\/\/|\/\*|\*|import[\s{]|export\s+(type\s+)?\{[^}]*\}\s+from|export\s+\*)/.test(l)
    )
      starts.push(i + 1);
  });
  starts.forEach((start, k) => {
    const end = (starts[k + 1] ?? lines.length + 1) - 1;
    const text = lines.slice(start - 1, end).join('\n');
    const first = lines[start - 1];
    const step =
      /^(Given|When|Then)\(\s*(?:(['"`])((?:\\.|(?!\2).)*)\2|\/((?:\\.|[^/])+)\/)\s*,\s*async\s*\(\s*\{([^}]*)\}/s.exec(
        text,
      );
    if (step) {
      const stepText = step[3] !== undefined ? step[3].replace(/\\(.)/g, '$1') : step[4];
      units.push({
        kind: 'step',
        lang: 'ts',
        file,
        name: stepText,
        regex: step[4] !== undefined,
        fixtures: step[5]
          .split(',')
          .map((s) => s.trim().split(':')[0].trim())
          .filter(Boolean),
        start,
        end,
      });
      return;
    }
    const hook = /^(Before|After|BeforeStep|AfterStep|BeforeAll|AfterAll)\(/.exec(first);
    if (hook) {
      units.push({
        kind: 'hook',
        lang: 'ts',
        file,
        name: hook[1],
        tags: /tags:\s*['"]([^'"]+)['"]/.exec(text)?.[1],
        start,
        end,
      });
      return;
    }
    const cls = /^(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/.exec(first);
    if (cls) {
      units.push(...tsMembers(file, lines, start, end, cls[1]));
      return;
    }
    const named =
      /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(?:function\*?\s+(\w+)|(?:const|let|var)\s+(\w+)|(?:type|interface|enum)\s+(\w+))/.exec(
        first,
      );
    const name = named?.[1] ?? named?.[2] ?? named?.[3] ?? null;
    if (name === 'test' && /base\.extend/.test(text)) {
      units.push(...tsMembers(file, lines, start, end, '(fixtures)', 'fixture'));
      return;
    }
    if (isSpec) return; // test.describe blocks: their tests are read below
    units.push({ kind: name ? 'top' : 'other', lang: 'ts', file, name, start, end });
  });
  if (isSpec) {
    const tests = [];
    lines.forEach((l, i) => {
      const m = /^\s*(test|setup)\(\s*(['"`])(.*?)\2.*?async\s*\(\s*\{([^}]*)\}/.exec(l);
      if (m)
        tests.push({
          kind: 'test',
          lang: 'ts',
          file,
          name: m[3],
          fixtures: m[4].split(',').map((s) => s.trim()),
          start: i + 1,
        });
    });
    tests.forEach((t, k) => {
      t.end = (tests[k + 1]?.start ?? lines.length + 1) - 1;
      units.push(t);
    });
  }
  return { file, lang: 'ts', imports, importLines, units: units.map((u) => finishUnit(u, lines)), src };
}

/** Members of a class (or of the fixtures object) at two-space indent; constructor assignments count per property. */
function tsMembers(file, lines, start, end, cls, kind = 'member') {
  const members = [];
  const types = {};
  const memberStart =
    /^ {2}(?:(?:public|private|protected|readonly|static|async|abstract|override|declare)\s+)*(?:get\s+|set\s+)?(constructor|[\w$]+)\s*[(<:=?!]/;
  for (let n = start + 1; n <= end; n++) {
    const m = memberStart.exec(lines[n - 1]);
    if (m) members.push({ kind, lang: 'ts', file, cls, name: m[1], start: n });
    const typed = /^ {2}(?:(?:public|private|protected|readonly|static)\s+)*([\w$]+)\s*[?!]?:\s*([A-Z][\w$]*)/.exec(
      lines[n - 1],
    );
    if (typed) types[typed[1]] = typed[2];
  }
  members.forEach((m, k) => (m.end = (members[k + 1]?.start ?? end) - 1));
  const out = [];
  for (const m of members) {
    if (m.name !== 'constructor') {
      out.push(m);
      continue;
    }
    // `this.x = ...` statements in the constructor belong to member x (a module's locators are set there).
    const assigns = [];
    for (let n = m.start; n <= m.end; n++) {
      const a = /^ {4}this\.([\w$]+)\s*=/.exec(lines[n - 1]);
      if (a) assigns.push({ kind, lang: 'ts', file, cls, name: a[1], start: n });
      const ctorParam = /(?:private|public|protected)\s+(?:readonly\s+)?([\w$]+)\s*:\s*([A-Z][\w$]*)/g;
      for (const p of lines[n - 1].matchAll(ctorParam)) types[p[1]] = p[2];
    }
    assigns.forEach((a, k) => (a.end = (assigns[k + 1]?.start ?? m.end + 1) - 1));
    out.push({ ...m, end: (assigns[0]?.start ?? m.end + 1) - 1 }, ...assigns);
  }
  // The class line and closing brace: a change there (extends, decorators) changes the whole class.
  out.push({ kind: 'class', lang: 'ts', file, cls, name: cls, start, end: start, types });
  for (const u of out) u.types = types;
  return out;
}

/** Java: one top-level type per file, members at two-space indent; @Given/@When/@Then methods are step definitions. */
function parseJava(file, src) {
  const lines = src.split('\n');
  const cls =
    /^(?:public\s+)?(?:final\s+)?(?:abstract\s+)?(?:class|interface|enum|record)\s+(\w+)/m.exec(src)?.[1] ?? file;
  const staticImports = new Set(
    [...src.matchAll(/^import static [\w.]*\.(\w+)\.(\w+);/gm)].map((m) => `${m[1]}.${m[2]}`),
  );
  const units = [];
  const types = {};
  let pending = null;
  lines.forEach((l, i) => {
    const n = i + 1;
    if (!/^ {2}\S/.test(l) || /^ {2}(\}|\/\/|\/\*|\*)/.test(l)) return;
    if (/^ {2}@/.test(l)) {
      pending ??= { start: n, annotations: [] };
      pending.annotations.push(l.trim());
      return;
    }
    const decl = l.trim();
    const isType = /\b(class|record|enum|interface)\s+(\w+)/.exec(decl);
    const call = decl.indexOf('(');
    const assign = decl.indexOf('=');
    const name =
      isType?.[2] ??
      (call >= 0 && (assign < 0 || call < assign)
        ? /([\w$]+)\s*$/.exec(decl.slice(0, call))?.[1]
        : /([\w$]+)\s*(=|;)/.exec(decl)?.[1]);
    const typeDecl =
      /^(?:(?:public|private|protected|static|final|abstract|synchronized)\s+)*([A-Z][\w$<>,\s?]*?)\s+([\w$]+)\s*[(=;]/.exec(
        decl,
      );
    if (typeDecl) types[typeDecl[2]] = typeDecl[1].replace(/<.*$/, '').trim();
    const annotations = pending?.annotations ?? [];
    const step = annotations.map((a) => /^@(Given|When|Then)\(\s*"((?:\\.|[^"\\])*)"\s*\)/.exec(a)).find(Boolean);
    const hook = annotations.find((a) => /^@(Before|After|BeforeStep|AfterStep)\b/.test(a));
    units.push({
      kind: step ? 'step' : hook ? 'hook' : isType ? 'type' : 'member',
      lang: 'java',
      file,
      cls,
      name: step ? step[2].replace(/\\\\/g, '\\').replace(/\\"/g, '"') : name,
      start: pending?.start ?? n,
    });
    pending = null;
  });
  units.forEach((u, k) => (u.end = (units[k + 1]?.start ?? lines.length) - 1));
  for (const u of units) {
    u.types = types;
    u.staticImports = staticImports;
  }
  // The class header (and anything outside the members): a change there changes the whole class.
  units.push({
    kind: 'class',
    lang: 'java',
    file,
    cls,
    name: cls,
    start: 1,
    end: (units[0]?.start ?? lines.length) - 1,
    types,
    staticImports,
  });
  return {
    file,
    lang: 'java',
    cls,
    imports: new Set(),
    units: units.map((u) => finishUnit(u, lines)),
    src,
    tokens: new Set(src.match(IDENT) ?? []),
  };
}

const CODE = [
  { dir: 'src', test: (f) => f.endsWith('.ts'), parse: parseTs },
  {
    dir: 'tests',
    test: (f) =>
      /\.(spec|setup)\.ts$/.test(f) && !f.startsWith('tests/architecture/') && !f.startsWith('tests/features/'),
    parse: parseTs,
  },
  { dir: 'java/src/test/java', test: (f) => f.endsWith('.java'), parse: parseJava },
];

/** Parses the code and features of the working tree (rev null) or of a revision. */
export function loadModel(rev = null) {
  const files = listFiles(rev);
  const code = new Map();
  for (const f of files) {
    const kind = CODE.find((c) => f.startsWith(`${c.dir}/`) && c.test(f));
    if (!kind) continue;
    const src = readAt(rev, f);
    if (src !== null) code.set(f, kind.parse(f, src));
  }
  const features = files
    .filter((f) => f.startsWith('features/') && f.endsWith('.feature'))
    .map((f) => parseFeature(f, readAt(rev, f) ?? ''));
  // TypeScript: which class each fixture gives (`checkoutPage: … use(new CheckoutPage(page))`), and where classes live.
  const classFile = new Map();
  for (const c of code.values())
    for (const u of c.units) if (u.kind === 'class') classFile.set(`${c.lang}:${u.cls}`, c.file);
  const fixtureClass = new Map();
  for (const c of code.values())
    for (const u of c.units)
      if (u.kind === 'fixture') {
        const made = /new\s+([A-Z]\w*)\s*\(/.exec(u.body)?.[1];
        if (made) fixtureClass.set(u.name, made);
      }
  return { rev, code, features, classFile, fixtureClass };
}

/** The classes a unit can name: its own, its fixtures', the types of its class's members, and their files' imports. */
function reachableFiles(model, u) {
  const c = model.code.get(u.file);
  const files = new Set([u.file, ...(c?.imports ?? [])]);
  for (const f of u.fixtures ?? []) {
    const file = model.classFile.get(`ts:${model.fixtureClass.get(f)}`);
    if (file) for (const x of [file, ...(model.code.get(file)?.imports ?? [])]) files.add(x);
  }
  return files;
}

/** The class a chain's root names in unit u: this, a fixture, a typed field or parameter, or a class itself. */
function rootClass(model, u, root) {
  if (root === 'this') return u.cls;
  if (u.fixtures?.includes(root)) return model.fixtureClass.get(root);
  const typed = u.types?.[root] ?? new RegExp(`\\b${root}\\s*:\\s*([A-Z][\\w$]*)`).exec(u.body)?.[1];
  if (typed) return typed;
  const local =
    new RegExp(`\\b([A-Z][\\w$]*)\\s+${root}\\s*=`).exec(u.body)?.[1] ??
    new RegExp(`\\b${root}\\s*=\\s*new\\s+([A-Z][\\w$]*)`).exec(u.body)?.[1];
  if (local) return local;
  if (/^[A-Z]/.test(root)) return root; // a static call on the class itself
  return null;
}

/** The type of member `name` of class `cls`, when the class declares it. */
function memberType(model, lang, cls, name) {
  const file = model.classFile.get(`${lang}:${cls}`);
  const unit = file && model.code.get(file)?.units.find((x) => x.cls === cls);
  return unit?.types?.[name] ?? null;
}

/** Does unit u use unit v? (v is a class member, top-level declaration or fixture; never a step or test.) */
export function uses(model, u, v) {
  if (u === v || u.lang !== v.lang || ['step', 'test', 'hook', 'other'].includes(v.kind) || !v.name) return false;
  if (v.kind === 'fixture') return u.file === v.file ? u.tokens.has(v.name) : (u.fixtures ?? []).includes(v.name);
  if (u.file === v.file) return u.tokens.has(v.name) && (v.kind !== 'class' || u.kind !== 'class');
  if (v.kind === 'class' || v.kind === 'type') {
    return u.lang === 'ts' ? reachableFiles(model, u).has(v.file) && u.tokens.has(v.name) : u.tokens.has(v.name);
  }
  if (!v.cls) return reachableFiles(model, u).has(v.file) && u.tokens.has(v.name); // a top-level function or constant
  // A class member: follow typed chains; fall back to "the member name on a class this file can reach".
  if (u.lang === 'java' && u.staticImports?.has(`${v.cls}.${v.name}`) && u.tokens.has(v.name)) return true;
  let unknownReceiver = false;
  for (const chain of u.chains) {
    const at = chain.indexOf(v.name, 1);
    if (at < 1) continue;
    let cls = rootClass(model, u, chain[0]);
    for (let k = 1; k < at && cls; k++) cls = memberType(model, u.lang, cls, chain[k]);
    if (cls === v.cls) return true;
    if (!cls) unknownReceiver = true;
  }
  if (!unknownReceiver) return false;
  return u.lang === 'ts' ? reachableFiles(model, u).has(v.file) : model.code.get(u.file)?.tokens.has(v.cls);
}

/** The units containing any of these lines (1-based) of a file. */
export const unitsAt = (parsed, lines) =>
  parsed ? parsed.units.filter((u) => [...lines].some((n) => n >= u.start && n <= u.end)) : [];
