import { env, STORAGE_STATE } from '../src/config/env';
// Our fixtures, as every UI test: a failed sign-in gets the same screenshot of the page (src/fixtures/evidence.ts).
import { expect, Tag, test as setup } from '../src/fixtures';

// Tagged @setup: every suite with an include list adds it (a grep also filters dependency projects), see src/tags.ts.
setup('authenticate as customer', { tag: [Tag.setup] }, async ({ page, loginPage }) => {
  await loginPage.open();
  await loginPage.signIn(env.customer.email, env.customer.password);
  await expect(page).toHaveURL(/\/account/);

  // Toolshop keeps its auth token in localStorage, which storageState captures.
  await page.context().storageState({ path: STORAGE_STATE });
});
