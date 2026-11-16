import { expect, Tag, test } from '../../src/fixtures';

// Seed for Playwright Test Agents (planner/generator): leaves the browser on the
// catalogue as a logged-in customer, which is the starting state for generated tests.
// Tagged @seed and excluded by the "nightly" suite (src/tags.ts); agents run it by file path.
test.describe('Seed', { tag: [Tag.seed] }, () => {
  test('seed', async ({ homePage, header }) => {
    await homePage.goto();
    await expect(header.userMenu).toBeVisible();
    await expect(homePage.productNames.first()).toBeVisible();
  });
});
