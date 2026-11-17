/**
 * Single registry of test tags and of the suites built from them.
 *
 * Tags decide which tests gate a PR and which only run at night, so they are a review-critical part of the
 * framework. Tests reference tags only through `Tag` (a typo is a compile error), CI and npm scripts select
 * suites only by name (`SUITE=pr`), and `npm run check:tags` fails on unknown tags or a test without a tier.
 * Changing what a suite runs therefore means changing this file, which keeps the decision visible in review.
 */
export const Tag = {
  // Tier: every test has exactly one (enforced by src/reporters/tag-guard.ts).
  smoke: '@smoke', // fast, business-critical; gates every PR
  regression: '@regression', // broader coverage; nightly
  setup: '@setup', // auth setup project, a dependency of the UI tests
  seed: '@seed', // starting state for Playwright Test Agents, not a test case

  // Kind: optional, any number.
  negative: '@negative',
  e2e: '@e2e',
  a11y: '@a11y',
  visual: '@visual',
  architecture: '@architecture', // static rules about the pipeline and code, no browser or Toolshop
  admin: '@admin', // signs in as admin and changes catalogue/orders: only against our own Toolshop
} as const;

export type TagValue = (typeof Tag)[keyof typeof Tag];

export const TIER_TAGS: readonly TagValue[] = [Tag.smoke, Tag.regression, Tag.setup, Tag.seed];

/** Kinds that run on Chromium only: axe results and screenshots do not depend on the engine. */
export const CHROMIUM_ONLY: readonly TagValue[] = [Tag.a11y, Tag.visual];

export interface Suite {
  /** Run tests with any of these tags (all tests when omitted). */
  include?: readonly TagValue[];
  /** Skip tests with any of these tags. */
  exclude?: readonly TagValue[];
}

/**
 * Named suites, selected with the SUITE environment variable (see playwright.config.ts).
 * `include` lists never need Tag.setup: suiteGrep adds it, because a grep also filters dependency projects
 * and the logged-in UI tests would otherwise run without a session.
 */
export const SUITES = {
  /** PR gate (TypeScript job): smoke + accessibility + visual. */
  pr: { include: [Tag.smoke, Tag.a11y, Tag.visual] },
  smoke: { include: [Tag.smoke] },
  a11y: { include: [Tag.a11y] },
  visual: { include: [Tag.visual] },
  /** Static pipeline/code rules; runs in the PR static stage before Toolshop is up. */
  architecture: { include: [Tag.architecture] },
  /** Nightly: everything except the agents' seed. */
  nightly: { exclude: [Tag.seed] },
} as const satisfies Record<string, Suite>;

export type SuiteName = keyof typeof SUITES;

const anyOf = (tags: readonly string[]): RegExp =>
  new RegExp(tags.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));

export function suiteGrep(suite: Suite): RegExp | undefined {
  return suite.include ? anyOf([...suite.include, Tag.setup]) : undefined;
}

export function suiteGrepInvert(suite: Suite, extra: readonly TagValue[] = []): RegExp | undefined {
  const tags = [...(suite.exclude ?? []), ...extra];
  return tags.length ? anyOf(tags) : undefined;
}

export function resolveSuite(name: string | undefined): Suite {
  if (!name) return {};
  if (!(name in SUITES)) {
    throw new Error(`Unknown SUITE "${name}". Known suites: ${Object.keys(SUITES).join(', ')}`);
  }
  return SUITES[name as SuiteName];
}
