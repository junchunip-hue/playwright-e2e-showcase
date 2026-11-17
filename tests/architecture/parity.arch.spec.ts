import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, Tag, test } from '../../src/fixtures';
import { filesUnder, ROOT } from './repo';

// TypeScript/Java parity (ADR 0009): every journey ships in both languages, and the test plan's "Java" column
// says exactly which IDs the Java suite covers. Reads source files only, so it runs in the static stage.

/** Test IDs used in TypeScript test titles, e.g. test('S2: ...') or test(`S2: ... ${x}`). */
function typescriptIds(): Set<string> {
  const specs = filesUnder(join(ROOT, 'tests'), (n) => n.endsWith('.spec.ts'));
  const titles = specs.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\btest\(\s*['`"]([ASUN]\d+):/g)]);
  return new Set(titles.map((m) => m[1]));
}

/** Test IDs used in Java display names, e.g. @DisplayName("S2: ..."). */
function javaIds(): Set<string> {
  const sources = filesUnder(join(ROOT, 'java', 'src', 'test', 'java'), (n) => n.endsWith('.java'));
  const names = sources.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/@DisplayName\("([ASUN]\d+):/g)]);
  return new Set(names.map((m) => m[1]));
}

/** IDs whose row in docs/test-plan.md has ✅ in the "Java" column. */
function planJavaIds(): Set<string> {
  const ids = new Set<string>();
  let javaColumn = -1;
  for (const line of readFileSync(join(ROOT, 'docs', 'test-plan.md'), 'utf8').split('\n')) {
    const cells = line.split('|').map((c) => c.trim());
    if (!line.startsWith('|')) javaColumn = -1;
    else if (cells.includes('Java')) javaColumn = cells.indexOf('Java');
    else if (javaColumn > 0 && cells[javaColumn] === '✅') ids.add(cells[1].replace(/\*/g, ''));
  }
  return ids;
}

const sorted = (ids: Iterable<string>): string[] => [...ids].sort();
/** Scenario tests (API, UI, journeys) run in both languages; N = quality and architecture checks stay TypeScript-only. */
const scenarios = (ids: Set<string>): string[] => sorted([...ids].filter((id) => /^[ASU]/.test(id)));

test.describe('TypeScript/Java parity', { tag: [Tag.smoke, Tag.architecture] }, () => {
  test('N3: every scenario (A, U, S) exists in both languages', () => {
    const ts = typescriptIds();
    const java = javaIds();

    expect(scenarios(ts).length, 'no scenarios found: the ID patterns no longer match').toBeGreaterThan(0);
    expect(scenarios(java), 'scenario IDs in Java vs TypeScript').toEqual(scenarios(ts));
  });

  test('N3: the test plan\'s Java column matches the Java suite', () => {
    expect(sorted(planJavaIds()), 'IDs marked Java ✅ in docs/test-plan.md vs IDs in java/').toEqual(sorted(javaIds()));
  });

  test('N3: every Java test ID also exists in TypeScript', () => {
    const ts = typescriptIds();

    expect(sorted([...javaIds()].filter((id) => !ts.has(id))), 'Java-only IDs').toEqual([]);
  });
});
