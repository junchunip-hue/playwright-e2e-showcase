import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { expect, Tag, test } from '../../src/fixtures';
import { filesUnder, rel, ROOT } from './repo';

// The Gherkin layers, the same in both languages (ADR 0012):
//   features/*.feature  → steps (Gherkin bindings) → pages (what a user does) → modules (locators only)
// These rules keep each layer to its job, so a step reads as one business action and a locator lives in one place.

const JAVA = join(ROOT, 'java', 'src', 'test', 'java', 'com', 'showcase');
const lines = (file: string) => readFileSync(file, 'utf8').split('\n');
/** Offending lines as "file:line: text", comments ignored. */
const offenders = (files: string[], pattern: RegExp) =>
  files.flatMap((f) =>
    lines(f).flatMap((text, i) => (pattern.test(text) && !/^\s*(\/\/|\*|\/\*)/.test(text) ? [`${rel(f)}:${i + 1}: ${text.trim()}`] : [])),
  );

test.describe('Gherkin layers', { tag: [Tag.smoke, Tag.architecture] }, () => {
  test('N3: modules only declare locators (no actions)', () => {
    const modules = [
      ...filesUnder(join(ROOT, 'src', 'modules'), (n) => n.endsWith('.ts')),
      ...filesUnder(join(JAVA, 'modules'), (n) => n.endsWith('.java')),
    ];

    expect(modules.length, 'no module files found').toBeGreaterThan(0);
    expect(offenders(modules, /\bawait\b|\.(click|fill|check|press|selectOption|navigate|goto|hover|type)\(/), 'actions in modules').toEqual([]);
  });

  test('N3: steps create no locators (they call pages and assert on their modules)', () => {
    const steps = [
      ...filesUnder(join(ROOT, 'src', 'steps'), (n) => n.endsWith('.ts')),
      ...filesUnder(join(JAVA, 'steps'), (n) => n.endsWith('Steps.java')),
    ];

    expect(steps.length, 'no step files found').toBeGreaterThan(0);
    expect(offenders(steps, /\.(locator|getBy[A-Za-z]+|\$\$?)\(/), 'locators created in steps').toEqual([]);
  });

  test('N3: no hand-written *.spec.js in tests/ (bddgen deletes them)', () => {
    // playwright-bdd writes the generated features to tests/features and clears tests/**/*.spec.js before each run.
    const handWritten = filesUnder(join(ROOT, 'tests'), (n) => n.endsWith('.spec.js')).filter(
      (f) => !rel(f).split(sep).join('/').startsWith('tests/features/'),
    );

    expect(handWritten.map(rel), 'hand-written .spec.js files').toEqual([]);
  });
});
