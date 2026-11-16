import { env } from '../../src/config/env';
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

  test('shows an error for a wrong password', { tag: [Tag.smoke, Tag.negative] }, async ({ page, loginPage }) => {
    await loginPage.goto();
    await loginPage.login(env.customer.email, 'definitely-wrong-password');

    await expect(loginPage.error).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login/);
  });
});
