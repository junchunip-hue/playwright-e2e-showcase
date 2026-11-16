import { env } from '../../src/config/env';
import { createCustomer } from '../../src/data/customers';
import { expect, Tag, test } from '../../src/fixtures';

test.describe('Login', () => {
  // These tests need a logged-out browser, so override the shared session.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('customer can log in with valid credentials', { tag: [Tag.smoke] }, async ({ page, loginPage, header }) => {
    await loginPage.goto();
    await loginPage.login(env.customer.email, env.customer.password);

    await expect(page).toHaveURL(/\/account/);
    await expect(header.userMenu).toBeVisible();
  });

  // Failed logins count towards an account lock (HTTP 423), so they target a throwaway account:
  // repeated runs must never lock the shared customer that the other tests sign in with.
  test('shows an error for a wrong password', { tag: [Tag.smoke, Tag.negative] }, async ({ api, page, loginPage }) => {
    const customer = await createCustomer(api);

    await loginPage.goto();
    await loginPage.login(customer.email, 'definitely-wrong-password');

    await expect(loginPage.error).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
