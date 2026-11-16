import { expect, test } from '../../src/fixtures';

// Seed for Playwright Test Agents (planner/generator): leaves the browser on the
// catalogue as a logged-in customer, which is the starting state for generated tests.
// Tagged @seed and excluded from the nightly regression (--grep-invert); agents run it by file path.
test.describe('Seed', { tag: '@seed' }, () => {
  test('seed', async ({ homePage, header }) => {
    await homePage.goto();
    await expect(header.userMenu).toBeVisible();
    await expect(homePage.productNames.first()).toBeVisible();
  });
});
