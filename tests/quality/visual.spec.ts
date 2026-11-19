import { expect, Tag, test } from '../../src/fixtures';

// Visual regression on Chromium only (CHROMIUM_ONLY in src/tags.ts).
// Baselines are Linux screenshots of the pinned, freshly seeded Toolshop in CI; they are created or refreshed by
// adding the `update-snapshots` label to a PR (.github/workflows/update-visual-baselines.yml).
// Component-level screenshots are preferred: they fail for a reason that is easy to read and are not
// affected by unrelated parts of the page.

test.describe('Visual regression', { tag: [Tag.visual, Tag.regression] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('N1: header navigation (anonymous)', async ({ loginPage, header }) => {
    await loginPage.open();
    await expect(loginPage.ui.email).toBeVisible();
    await expect(header.root).toHaveScreenshot('header-anonymous.png');
  });

  test('N1: login form', async ({ loginPage }) => {
    await loginPage.open();
    await expect(loginPage.ui.email).toBeVisible();
    await expect(loginPage.ui.form).toHaveScreenshot('login-form.png');
  });

  test('N1: contact form', async ({ contactPage }) => {
    await contactPage.goto();
    await expect(contactPage.submit).toBeVisible();
    await expect(contactPage.form).toHaveScreenshot('contact-form.png');
  });

  test('N1: catalogue filters', async ({ homePage }) => {
    await homePage.goto();
    await expect(homePage.productNames.first()).toBeVisible();
    await expect(homePage.filtersPanel).toHaveScreenshot('catalogue-filters.png');
  });

  // Full-page example: anything that changes between runs is masked rather than compared.
  // The footer prints the Toolshop build date, and CI builds Toolshop on every run.
  test('N1: login page (full page)', async ({ loginPage, header, footer, page }) => {
    await loginPage.open();
    await expect(loginPage.ui.email).toBeVisible();
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      mask: [header.notificationBar, footer.buildInfo],
    });
  });
});
