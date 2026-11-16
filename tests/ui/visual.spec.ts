import { expect, test } from '../../src/fixtures';

// Visual regression on Chromium only (see grepInvert in playwright.config.ts).
// Baselines are Linux screenshots of the pinned, freshly seeded Toolshop in CI; they are created or refreshed by
// adding the `update-snapshots` label to a PR (.github/workflows/update-visual-baselines.yml).
// Component-level screenshots are preferred: they fail for a reason that is easy to read and are not
// affected by unrelated parts of the page.

test.describe('Visual regression', { tag: ['@visual', '@regression'] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('header navigation (anonymous)', async ({ loginPage, page }) => {
    await loginPage.goto();
    await expect(loginPage.email).toBeVisible();
    await expect(page.locator('nav.navbar')).toHaveScreenshot('header-anonymous.png');
  });

  test('login form', async ({ loginPage, page }) => {
    await loginPage.goto();
    await expect(loginPage.email).toBeVisible();
    await expect(page.getByTestId('login-form')).toHaveScreenshot('login-form.png');
  });

  test('contact form', async ({ page }) => {
    await page.goto('/contact');
    const submit = page.getByTestId('contact-submit');
    await expect(submit).toBeVisible();
    await expect(page.locator('form').filter({ has: submit })).toHaveScreenshot('contact-form.png');
  });

  test('catalogue filters', async ({ homePage, page }) => {
    await homePage.goto();
    await expect(homePage.productNames.first()).toBeVisible();
    // data-test="filters" is on both the mobile toggle button and the panel; screenshot the panel.
    await expect(page.locator('div[data-test="filters"]')).toHaveScreenshot('catalogue-filters.png');
  });

  // Full-page example: anything that changes between runs is masked rather than compared.
  test('login page (full page)', async ({ loginPage, page }) => {
    await loginPage.goto();
    await expect(loginPage.email).toBeVisible();
    await expect(page).toHaveScreenshot('login-page.png', {
      fullPage: true,
      mask: [page.getByTestId('notification-bar')],
    });
  });
});
