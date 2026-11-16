import type AxeBuilder from '@axe-core/playwright';
import { expect, type TestInfo } from '@playwright/test';

/** The standard most accessibility requirements point to: WCAG 2.1 levels A and AA. */
export const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] as const;

export type ScannedPage = 'home' | 'product' | 'login' | 'contact' | 'cart' | 'account';

/**
 * Known violations of the system under test, keyed by axe rule id.
 * Toolshop is a third-party practice app we cannot fix, so existing issues are recorded here
 * (with where they come from) instead of failing every run. Any violation of a rule NOT listed fails the test,
 * so regressions are still caught. Entries that stop occurring are reported so the list can shrink.
 */
const SITE_WIDE_ISSUES: Record<string, string> = {
  // Header on every page: the language button (#language) and the cart link expose an accessible name
  // that does not contain their visible text, so speech-input users cannot activate them by what they see.
  'label-content-name-mismatch': 'header language selector / cart link: accessible name differs from visible text',
};

const PAGE_ISSUES: Record<ScannedPage, Record<string, string>> = {
  home: {
    list: 'category filter: <ul> directly contains non-<li> children (checkbox groups)',
  },
  product: {},
  login: {
    'button-name': 'password visibility toggle (eye icon) has no accessible name',
  },
  contact: {},
  cart: {},
  account: {},
};

export const KNOWN_ISSUES: Record<ScannedPage, Record<string, string>> = Object.fromEntries(
  Object.entries(PAGE_ISSUES).map(([page, issues]) => [page, { ...SITE_WIDE_ISSUES, ...issues }]),
) as Record<ScannedPage, Record<string, string>>;

/**
 * Runs an axe scan, attaches the full result to the report and fails on violations that are not known issues.
 */
export async function expectNoNewViolations(
  makeAxeBuilder: () => AxeBuilder,
  testInfo: TestInfo,
  pageName: ScannedPage,
): Promise<void> {
  const results = await makeAxeBuilder().analyze();

  await testInfo.attach(`axe-${pageName}.json`, {
    body: JSON.stringify(results.violations, null, 2),
    contentType: 'application/json',
  });

  const known = KNOWN_ISSUES[pageName];
  const found = new Set(results.violations.map((v) => v.id));

  for (const v of results.violations.filter((v) => v.id in known)) {
    testInfo.annotations.push({ type: 'known a11y issue', description: `${v.id} (${v.nodes.length} node(s)): ${known[v.id]}` });
  }
  for (const rule of Object.keys(known).filter((rule) => !found.has(rule))) {
    testInfo.annotations.push({ type: 'fixed a11y issue', description: `${rule} no longer occurs on ${pageName}: remove it from KNOWN_ISSUES` });
  }

  const unexpected = results.violations
    .filter((v) => !(v.id in known))
    .map((v) => `${v.id} [${v.impact}] ${v.help}: ${v.nodes.length} node(s), e.g. ${v.nodes[0]?.target.join(' ')}`);

  expect(unexpected, `new accessibility violations on ${pageName}`).toEqual([]);
}
