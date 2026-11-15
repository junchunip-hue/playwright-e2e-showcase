import { expect, test } from '../../src/fixtures';

// Seed for Playwright Test Agents (planner/generator): leaves the browser on the
// catalogue as a logged-in customer, which is the starting state for generated tests.
test.describe('Seed', () => {
  test('seed', async ({ homePage, header }) => {
    await homePage.goto();
    await expect(header.userMenu).toBeVisible();
    await expect(homePage.productNames.first()).toBeVisible();
  });
});
