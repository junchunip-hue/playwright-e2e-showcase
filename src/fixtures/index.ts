import AxeBuilder from '@axe-core/playwright';
import { test as base } from 'playwright-bdd';
import { WCAG_TAGS } from '../a11y/accessibility';
import type { APIResponse } from '@playwright/test';
import { ApiClient, type Address, type NewCustomer, type NewProduct, type Product, type ProductFilter } from '../api/ApiClient';
import type { InvoiceStatus, ProductPage as ProductListPage, ProductSearchPage } from '../api/schemas';
import { createBdd } from 'playwright-bdd';
import type { InvalidCard } from '../data/payments';
import { env, isPublicDemo } from '../config/env';
import { Tag } from '../tags';
import { ComparisonPage, FavoritesPage, InvoiceDetailsPage, InvoicesPage } from '../pages/account.page';
import { AccountPage } from '../pages/AccountPage';
import { CheckoutPage } from '../pages/checkout.page';
import { Footer } from '../pages/components/Footer';
import { HeaderModule } from '../modules/header.module';
import { ContactPage } from '../pages/ContactPage';
import { HomePage } from '../pages/home.page';
import { NetworkPage } from '../pages/network.page';
import { LoginPage } from '../pages/login.page';
import { ProductPage } from '../pages/product.page';

/**
 * What one scenario's steps hand to each other (e.g. the customer a Given step registered for a later When step).
 * A fresh object per scenario, so scenarios never share state. Java twin: steps/ScenarioContext.java.
 */
export interface ScenarioContext {
  customer?: NewCustomer;
  /** A product picked through the API (e.g. one in stock right now). */
  product?: Product;
  /** Product names the search API returned, to compare with what the UI shows. */
  searchApiNames?: string[];
  /** Details of a guest who checks out without registering (S4). */
  guest?: NewCustomer;
  /** The cart total shown in step 1 of checkout: the amount the invoice must have. */
  cartTotal?: number;
  /** The invoice number shown after the order was placed. */
  invoiceNumber?: string;
  /** An invalid card entered in step 4 (S2 negative cases). */
  invalidCard?: InvalidCard;
  /** The id of the order's invoice, as the admin found it (S3). */
  invoiceId?: string;
  /** The status message the admin set when shipping (S3). */
  shippedMessage?: string;
  /** Several products picked through the API (S5: two different ones in stock). */
  products?: Product[];
  /** The price the comparison page showed per product name (S5). */
  comparison?: Map<string, number>;
  /** The invoice PDF as downloaded (S5). */
  pdf?: { fileName: string; body: Buffer };
  // API scenarios (features/api)
  /** The last raw API response a When step sent, for status and body checks. */
  response?: APIResponse;
  /** An access token a step signed in for. */
  token?: string;
  /** A page of the catalogue list (A1). */
  productPage?: ProductListPage;
  /** A search result (A0). */
  searchResult?: ProductSearchPage;
  /** Field paths a contract check reported (A0, the schema guard). */
  contractProblems?: string[];
  /** The sort of a filtered listing (A7). */
  sort?: NonNullable<ProductFilter['sort']>;
  /** The data the admin published a product with (A8). */
  newProduct?: NewProduct;
  /** An address from the postcode lookup (A0). */
  address?: Address;
  /** Someone else's order (A11). */
  order?: { id: string; status: InvoiceStatus };
}

type Fixtures = {
  /** Values shared between the steps of one Gherkin scenario. */
  ctx: ScenarioContext;
  loginPage: LoginPage;
  homePage: HomePage;
  productPage: ProductPage;
  checkoutPage: CheckoutPage;
  contactPage: ContactPage;
  accountPage: AccountPage;
  invoicesPage: InvoicesPage;
  invoiceDetailsPage: InvoiceDetailsPage;
  comparisonPage: ComparisonPage;
  favoritesPage: FavoritesPage;
  header: HeaderModule;
  footer: Footer;
  api: ApiClient;
  /** The network as the browser sees it: delay or fail requests (S6, network mocking). */
  network: NetworkPage;
  /**
   * Skips a test tagged @own-toolshop or @admin on the shared public demo (runs on our own Toolshop: CI, local
   * Docker). @admin tests change catalogue or orders, even when they never sign in as the admin (A10).
   */
  ownToolshopOnly: void;
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
  ctx: async ({}, use) => use({}),
  // A feature or scenario tagged @logged-out starts without the signed-in session that the UI projects load.
  storageState: async ({ storageState }, use, testInfo) =>
    use(testInfo.tags.includes(Tag.loggedOut) ? { cookies: [], origins: [] } : storageState),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  homePage: async ({ page }, use) => use(new HomePage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  contactPage: async ({ page }, use) => use(new ContactPage(page)),
  accountPage: async ({ page }, use) => use(new AccountPage(page)),
  invoicesPage: async ({ page }, use) => use(new InvoicesPage(page)),
  invoiceDetailsPage: async ({ page }, use) => use(new InvoiceDetailsPage(page)),
  comparisonPage: async ({ page }, use) => use(new ComparisonPage(page)),
  favoritesPage: async ({ page }, use) => use(new FavoritesPage(page)),
  header: async ({ page }, use) => use(new HeaderModule(page)),
  footer: async ({ page }, use) => use(new Footer(page)),
  network: async ({ page }, use) => use(new NetworkPage(page)),
  ownToolshopOnly: [
    async ({}, use, testInfo) => {
      const ownOnly = testInfo.tags.includes(Tag.ownToolshop) || testInfo.tags.includes(Tag.admin);
      testInfo.skip(isPublicDemo && ownOnly, 'needs our own Toolshop (CI, local Docker), not the public demo');
      await use();
    },
    { auto: true },
  ],

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

/** Gherkin step functions bound to the fixtures above: steps get page objects injected, like tests do. */
export const { Given, When, Then } = createBdd(test);
