import { expect, test as setup } from '@playwright/test';
import { env, STORAGE_STATE } from '../src/config/env';
import { LoginPage } from '../src/pages/LoginPage';

// Tagged @setup so `--grep "@smoke|@setup"` still runs it (grep also filters dependency projects).
setup('authenticate as customer', { tag: '@setup' }, async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.goto();
  await loginPage.login(env.customer.email, env.customer.password);
  await expect(page).toHaveURL(/\/account/);

  // Toolshop keeps its auth token in localStorage, which storageState captures.
  await page.context().storageState({ path: STORAGE_STATE });
});
