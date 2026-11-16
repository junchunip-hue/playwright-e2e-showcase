import type { FullConfig, FullResult, Reporter, Suite, TestCase } from '@playwright/test/reporter';
import { Tag, TIER_TAGS, type TagValue } from '../tags';

/**
 * `npm run check:tags`: lists every test (no browser is started) and fails when
 *  - a test carries a tag that is not registered in src/tags.ts, or
 *  - a test does not have exactly one tier tag (smoke / regression / setup / seed).
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
    // The same test runs in several projects; check and count it once.
    const seen = new Set<string>();

    for (const test of suite.allTests()) {
      const id = `${test.location.file}:${test.location.line}`;
      if (seen.has(id)) continue;
      seen.add(id);

      for (const tag of test.tags) {
        this.counts.set(tag, (this.counts.get(tag) ?? 0) + 1);
        if (!known.has(tag)) this.problems.push(`${describe(test)}: unknown tag ${tag} (register it in src/tags.ts)`);
      }

      const tiers = test.tags.filter((t) => TIER_TAGS.includes(t as TagValue));
      if (tiers.length !== 1) {
        const found = tiers.length ? tiers.join(', ') : 'none';
        this.problems.push(`${describe(test)}: needs exactly one tier tag of ${TIER_TAGS.join(', ')} (found ${found})`);
      }
    }

    console.log(`Tag check: ${seen.size} tests`);
    for (const tag of [...this.counts.keys()].sort()) console.log(`  ${tag.padEnd(12)} ${this.counts.get(tag)}`);
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

function describe(test: TestCase): string {
  return `${test.location.file.replace(/.*[\\/]tests[\\/]/, 'tests/')}:${test.location.line} "${test.title}"`;
}
