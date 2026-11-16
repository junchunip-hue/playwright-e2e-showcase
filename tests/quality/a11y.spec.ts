import { expectNoNewViolations } from '../../src/a11y/accessibility';
import { expect, Tag, test } from '../../src/fixtures';

// Automated WCAG 2.1 A/AA checks with axe-core. Known Toolshop issues are listed in src/a11y/accessibility.ts;
// anything new fails. Automated scans find roughly a third of real issues, so this complements, not replaces,
// manual keyboard and screen-reader checks. Runs on Chromium only (CHROMIUM_ONLY in src/tags.ts).

test.describe('Accessibility (anonymous visitor)', { tag: [Tag.a11y, Tag.regression] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('N2: catalogue page', async ({ homePage, makeAxeBuilder }, testInfo) => {
    await homePage.goto();
    await expect(homePage.productNames.first()).toBeVisible();
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'home');
  });

  test('N2: product detail page', async ({ api, productPage, makeAxeBuilder }, testInfo) => {
    const product = await api.products.findInStock();
    await productPage.goto(product.id);
    await expect(productPage.name).toHaveText(product.name);
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'product');
  });

  test('N2: login page', async ({ loginPage, makeAxeBuilder }, testInfo) => {
    await loginPage.goto();
    await expect(loginPage.form.email).toBeVisible();
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'login');
  });

  test('N2: contact page', async ({ contactPage, makeAxeBuilder }, testInfo) => {
    await contactPage.goto();
    await expect(contactPage.submit).toBeVisible();
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'contact');
  });
});

test.describe('Accessibility (logged-in customer)', { tag: [Tag.a11y, Tag.regression] }, () => {
  test('N2: cart step of checkout', async ({ api, productPage, header, checkoutPage, makeAxeBuilder }, testInfo) => {
    const product = await api.products.findInStock();
    await productPage.goto(product.id);
    await productPage.addToCart.click();
    await expect(header.cartQuantity).toHaveText('1');

    await checkoutPage.goto();
    await expect(checkoutPage.productTitles).toHaveText([product.name]);
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'cart');
  });

  test('N2: account page', async ({ accountPage, header, makeAxeBuilder }, testInfo) => {
    await accountPage.goto();
    await expect(header.userMenu).toBeVisible();
    await expect(accountPage.title).toBeVisible();
    await expectNoNewViolations(makeAxeBuilder, testInfo, 'account');
  });
});
