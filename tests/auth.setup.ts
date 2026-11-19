import { expect, test as setup } from '@playwright/test';
import { env, STORAGE_STATE } from '../src/config/env';
import { LoginPage } from '../src/pages/login.page';
import { Tag } from '../src/tags';

// Tagged @setup: every suite with an include list adds it (a grep also filters dependency projects), see src/tags.ts.
setup('authenticate as customer', { tag: [Tag.setup] }, async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.open();
  await loginPage.signIn(env.customer.email, env.customer.password);
  await expect(page).toHaveURL(/\/account/);

  // Toolshop keeps its auth token in localStorage, which storageState captures.
  await page.context().storageState({ path: STORAGE_STATE });
});
