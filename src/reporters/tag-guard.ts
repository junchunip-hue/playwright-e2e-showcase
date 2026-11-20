import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import { RUNNER_TAG, Tag, TIER_TAGS, type TagValue } from '../tags';

/** Test titles start with their test-plan ID: A = API, U = UI, S = story/journey, N = non-functional. */
export const TEST_ID = /^([ASUN]\d+): /;

/** Tiers that are infrastructure, not test cases, and therefore have no test-plan ID. */
const WITHOUT_ID: readonly TagValue[] = [Tag.setup, Tag.seed];

/**
 * `npm run check:tags`: lists every test (no browser is started) and fails when
 *  - a test carries a tag that is not registered in src/tags.ts,
 *  - a test does not have exactly one tier tag (smoke / regression / setup / seed), or
 *  - a test title does not start with an ID from docs/test-plan.md (e.g. "U6: ..."), so the plan and the code
 *    cannot drift apart.
 * Both lanes read the same feature files (features/), so an ID has the same tier in TypeScript and Java by construction.
 * It also prints how many tests each tag selects, so a reviewer sees the effect of a tag change at a glance.
 */
export default class TagGuard implements Reporter {
  private problems: string[] = [];
  private counts = new Map<string, number>();

  printsToStdio(): boolean {
    return true;
  }

  onBegin(_config: FullConfig, suite: Suite): void {
    const known = new Set<string>(Object.values(Tag));
    const planIds = testPlanIds();
    // The same test runs in several projects; check and count it once.
    const seen = new Set<string>();

    for (const test of suite.allTests()) {
      const key = `${test.location.file}:${test.location.line}`;
      if (seen.has(key)) continue;
      seen.add(key);

      for (const tag of test.tags) {
        this.counts.set(tag, (this.counts.get(tag) ?? 0) + 1);
        if (!known.has(tag) && !RUNNER_TAG.test(tag)) this.problems.push(`${describe(test)}: unknown tag ${tag} (register it in src/tags.ts)`);
      }

      const tiers = test.tags.filter((t) => TIER_TAGS.includes(t as TagValue));
      if (tiers.length !== 1) {
        const found = tiers.length ? tiers.join(', ') : 'none';
        this.problems.push(`${describe(test)}: needs exactly one tier tag of ${TIER_TAGS.join(', ')} (found ${found})`);
      }

      if (tiers.some((t) => WITHOUT_ID.includes(t as TagValue))) continue;
      const id = TEST_ID.exec(test.title)?.[1];
      if (!id) this.problems.push(`${describe(test)}: title must start with a test-plan ID, e.g. "U6: ..."`);
      else if (!planIds.has(id)) this.problems.push(`${describe(test)}: ID ${id} is not in docs/test-plan.md`);
    }

    console.log(`Tag check: ${seen.size} tests`);
    for (const tag of [...this.counts.keys()].sort()) console.log(`  ${tag.padEnd(15)} ${this.counts.get(tag)}`);
  }

  async onEnd(): Promise<{ status: FullResult['status'] } | void> {
    if (!this.problems.length) {
      console.log('Tag check passed.');
      return;
    }
    console.error(`Tag check failed (${this.problems.length}):`);
    for (const p of this.problems) console.error(`  - ${p}`);
    return { status: 'failed' };
  }
}

/** IDs in the first column of the test-plan tables, e.g. "| A4 |" or "| **U6** |". */
function testPlanIds(): Set<string> {
  const plan = readFileSync(resolve(__dirname, '..', '..', 'docs', 'test-plan.md'), 'utf8');
  return new Set([...plan.matchAll(/^\|\s*\**([ASUN]\d+)\**\s*\|/gm)].map((m) => m[1]));
}

function describe(test: TestCase): string {
  return `${test.location.file.replace(/.*[\\/]tests[\\/]/, 'tests/')}:${test.location.line} "${test.title}"`;
}
