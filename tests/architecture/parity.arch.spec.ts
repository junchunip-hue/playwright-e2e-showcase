import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { expect, Tag, test } from '../../src/fixtures';
import { filesUnder, ROOT } from './repo';

// TypeScript/Java parity (ADR 0009): every journey ships in both languages, and the test plan's "Java" column
// says exactly which IDs the Java suite covers. Reads source files only, so it runs in the static stage.

/**
 * Test IDs of the Gherkin scenarios in features/ ("Scenario: U1: ..."). Both suites run these same files
 * (TypeScript: playwright-bdd; Java: com.showcase.RunCucumberTest), so their IDs count for both languages; a step
 * without a definition fails the scenario in either language.
 */
function featureIds(): Set<string> {
  const features = filesUnder(join(ROOT, 'features'), (n) => n.endsWith('.feature'));
  const names = features.flatMap((f) => [
    ...readFileSync(f, 'utf8').matchAll(/^\s*Scenario(?: Outline)?:\s*([ASUNC]\d+):/gm),
  ]);
  return new Set(names.map((m) => m[1]));
}

/** Test IDs used in TypeScript test titles, e.g. test('S2: ...') or test(`S2: ... ${x}`), plus the features. */
function typescriptIds(): Set<string> {
  const specs = filesUnder(join(ROOT, 'tests'), (n) => n.endsWith('.spec.ts'));
  const titles = specs.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/\btest\(\s*['`"]([ASUNC]\d+):/g)]);
  return new Set([...titles.map((m) => m[1]), ...featureIds()]);
}

/** Test IDs used in Java display names, e.g. @DisplayName("S2: ..."), plus the features the Cucumber suite runs. */
function javaIds(): Set<string> {
  const sources = filesUnder(join(ROOT, 'java', 'src', 'test', 'java'), (n) => n.endsWith('.java'));
  const names = sources.flatMap((f) => [...readFileSync(f, 'utf8').matchAll(/@DisplayName\("([ASUNC]\d+):/g)]);
  const runsFeatures = existsSync(join(ROOT, 'java', 'src', 'test', 'java', 'com', 'showcase', 'RunCucumberTest.java'));
  return new Set([...names.map((m) => m[1]), ...(runsFeatures ? featureIds() : [])]);
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
/** Scenario tests (API, UI, journeys, controls) run in both languages; N = quality and architecture checks stay TypeScript-only. */
const scenarios = (ids: Set<string>): string[] => sorted([...ids].filter((id) => /^[ASUC]/.test(id)));

test.describe('TypeScript/Java parity', { tag: [Tag.smoke, Tag.architecture] }, () => {
  test('N3: every scenario (A, U, S, C) exists in both languages', () => {
    const ts = typescriptIds();
    const java = javaIds();

    expect(scenarios(ts).length, 'no scenarios found: the ID patterns no longer match').toBeGreaterThan(0);
    expect(scenarios(java), 'scenario IDs in Java vs TypeScript').toEqual(scenarios(ts));
  });

  test("N3: the test plan's Java column matches the Java suite", () => {
    expect(sorted(planJavaIds()), 'IDs marked Java ✅ in docs/test-plan.md vs IDs in java/').toEqual(sorted(javaIds()));
  });

  test('N3: every Java test ID also exists in TypeScript', () => {
    const ts = typescriptIds();

    expect(sorted([...javaIds()].filter((id) => !ts.has(id))), 'Java-only IDs').toEqual([]);
  });

  test('N3: both suites retry a failed test equally often in CI, and never locally', () => {
    // Same retries = same meaning of "flaky" in the pipeline summary: a test that passed only on a retry.
    const config = readFileSync(join(ROOT, 'playwright.config.ts'), 'utf8');
    const pom = readFileSync(join(ROOT, 'java', 'pom.xml'), 'utf8');
    const ts = /retries:\s*isCI\s*\?\s*(\d+)\s*:\s*0\b/.exec(config)?.[1];
    // The rerun count lives only in the profile that the CI environment variable switches on.
    const profile = /<profile>\s*<id>ci-retries<\/id>[\s\S]*?<\/profile>/.exec(pom)?.[0] ?? '';
    const java = /<surefire\.rerunFailingTestsCount>(\d+)</.exec(profile)?.[1];
    const javaOutsideProfile = pom.replace(profile, '').includes('rerunFailingTestsCount');

    expect(ts, 'playwright.config.ts: retries: isCI ? <n> : 0').toBeDefined();
    expect(profile, 'java/pom.xml: profile ci-retries').toMatch(/<name>env\.CI<\/name>/);
    expect(java, 'Java reruns (pom.xml, profile ci-retries) vs TypeScript retries').toBe(ts);
    expect(javaOutsideProfile, 'Java reruns set outside the CI-only profile').toBe(false);
  });
});
