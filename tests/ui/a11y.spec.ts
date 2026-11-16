import { expectNoNewViolations } from '../../src/a11y/accessibility';
import { expect, test } from '../../src/fixtures';

// Automated WCAG 2.1 A/AA checks with axe-core. Known Toolshop issues are listed in src/a11y/accessibility.ts;
// anything new fails. Automated scans find roughly a third of real issues, so this complements, not replaces,
// manual keyboard and screen-reader checks. Runs on Chromium only (see grepInvert in playwright.config.ts).

test.describe('Accessibility (anonymous visitor)', { tag: ['@a11y', '@regression'] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('catalogue page', async ({ homePage, makeAxeBuilder }, testInfo) => {
    await homePage.goto();
    await expect(homePage.productNames.first()).toBeVisible();
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'home');
  });

  test('product detail page', async ({ api, productPage, makeAxeBuilder }, testInfo) => {
    const product = await api.findInStockProduct();
    await productPage.goto(product.id);
    await expect(productPage.name).toHaveText(product.name);
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'product');
  });

  test('login page', async ({ loginPage, makeAxeBuilder }, testInfo) => {
    await loginPage.goto();
    await expect(loginPage.form.email).toBeVisible();
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'login');
  });

  test('contact page', async ({ contactPage, makeAxeBuilder }, testInfo) => {
    await contactPage.goto();
    await expect(contactPage.submit).toBeVisible();
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'contact');
  });
});

test.describe('Accessibility (logged-in customer)', { tag: ['@a11y', '@regression'] }, () => {
  test('cart step of checkout', async ({ api, productPage, header, checkoutPage, makeAxeBuilder }, testInfo) => {
    const product = await api.findInStockProduct();
    await productPage.goto(product.id);
    await productPage.addToCart.click();
    await expect(header.cartQuantity).toHaveText('1');

    await checkoutPage.goto();
    await expect(checkoutPage.productTitles).toHaveText([product.name]);
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'cart');
  });

  test('account page', async ({ accountPage, header, makeAxeBuilder }, testInfo) => {
    await accountPage.goto();
    await expect(header.userMenu).toBeVisible();
    await expect(accountPage.title).toBeVisible();
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'account');
  });
});
