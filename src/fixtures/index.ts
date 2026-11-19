import AxeBuilder from '@axe-core/playwright';
import { test as base } from '@playwright/test';
import { WCAG_TAGS } from '../a11y/accessibility';
import { ApiClient } from '../api/ApiClient';
import { CheckoutFlow } from '../flows/CheckoutFlow';
import { ShopperFlow } from '../flows/ShopperFlow';
import { env, isPublicDemo } from '../config/env';
import { AccountInvoicesPage } from '../pages/AccountInvoicesPage';
import { AccountPage } from '../pages/AccountPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { ComparisonPage } from '../pages/ComparisonPage';
import { FavoritesPage } from '../pages/FavoritesPage';
import { Footer } from '../pages/components/Footer';
import { Header } from '../pages/components/Header';
import { ContactPage } from '../pages/ContactPage';
import { HomePage } from '../pages/HomePage';
import { InvoiceDetailsPage } from '../pages/InvoiceDetailsPage';
import { LoginPage } from '../pages/LoginPage';
import { ProductPage } from '../pages/ProductPage';

type Fixtures = {
  loginPage: LoginPage;
  homePage: HomePage;
  productPage: ProductPage;
  checkoutPage: CheckoutPage;
  contactPage: ContactPage;
  accountPage: AccountPage;
  accountInvoicesPage: AccountInvoicesPage;
  invoiceDetailsPage: InvoiceDetailsPage;
  comparisonPage: ComparisonPage;
  favoritesPage: FavoritesPage;
  header: Header;
  footer: Footer;
  api: ApiClient;
  /** Business steps of the checkout journey (src/flows), built on the page objects above. */
  checkout: CheckoutFlow;
  /** What a signed-in customer does outside checkout: favourites, comparison, invoice download (src/flows). */
  shopper: ShopperFlow;
  /**
   * Access token of the seeded admin. Tests that use it change shared data (catalogue, orders), so they are
   * skipped against the public demo and run against our own Toolshop only (CI, local Docker).
   */
  adminToken: string;
  /** Returns an AxeBuilder for the current page, preconfigured for WCAG 2.1 A/AA. */
  makeAxeBuilder: () => AxeBuilder;
};

/**
 * Tests import { test, expect } from here instead of '@playwright/test',
 * so page objects and the API client are injected rather than constructed in every test.
 */
export const test = base.extend<Fixtures>({
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  homePage: async ({ page }, use) => use(new HomePage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  contactPage: async ({ page }, use) => use(new ContactPage(page)),
  accountPage: async ({ page }, use) => use(new AccountPage(page)),
  accountInvoicesPage: async ({ page }, use) => use(new AccountInvoicesPage(page)),
  invoiceDetailsPage: async ({ page }, use) => use(new InvoiceDetailsPage(page)),
  comparisonPage: async ({ page }, use) => use(new ComparisonPage(page)),
  favoritesPage: async ({ page }, use) => use(new FavoritesPage(page)),
  header: async ({ page }, use) => use(new Header(page)),
  footer: async ({ page }, use) => use(new Footer(page)),
  checkout: async ({ productPage, header, checkoutPage }, use) => use(new CheckoutFlow(productPage, header, checkoutPage)),
  shopper: async ({ page, loginPage, productPage, comparisonPage, favoritesPage, accountInvoicesPage, invoiceDetailsPage }, use) =>
    use(
      new ShopperFlow(page, {
        login: loginPage,
        product: productPage,
        comparison: comparisonPage,
        favorites: favoritesPage,
        invoices: accountInvoicesPage,
        invoiceDetails: invoiceDetailsPage,
      }),
    ),

  api: async ({ playwright }, use) => {
    const context = await playwright.request.newContext({ baseURL: env.apiURL });
    await use(new ApiClient(context));
    await context.dispose();
  },

  adminToken: async ({ api }, use, testInfo) => {
    testInfo.skip(isPublicDemo, 'changes catalogue and orders: runs against our own Toolshop only (CI, local Docker)');
    await use(await api.auth.login(env.admin.email, env.admin.password));
  },

  makeAxeBuilder: async ({ page }, use) => {
    await use(() => new AxeBuilder({ page }).withTags([...WCAG_TAGS]));
  },
});

export { expect } from '@playwright/test';
export { Tag } from '../tags';
