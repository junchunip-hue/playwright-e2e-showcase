import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';
import type { NewCustomer, Product } from '../api/ApiClient';
import type { AccountInvoicesPage } from '../pages/AccountInvoicesPage';
import type { ComparisonPage } from '../pages/ComparisonPage';
import type { FavoritesPage } from '../pages/FavoritesPage';
import type { InvoiceDetailsPage } from '../pages/InvoiceDetailsPage';
import type { LoginPage } from '../pages/LoginPage';
import type { ProductPage } from '../pages/ProductPage';

/** How long the invoice PDF may take: a background job writes it, and the page polls its status every 20 s. */
const PDF_READY_TIMEOUT = 180_000;

/**
 * What a signed-in customer does outside checkout (S5), as business steps:
 *
 *   await shopper.signIn(customer);
 *   await shopper.addToFavorites(product);
 *   const prices = await shopper.compare([a, b]);
 *   const pdf = await shopper.downloadInvoice(invoiceNumber);
 *
 * Same rules as CheckoutFlow: page objects hold the locators, the flow holds the order and the waits, the test
 * holds the business assertions. Each step is a test.step.
 */
export class ShopperFlow {
  constructor(
    private readonly page: Page,
    private readonly pages: {
      login: LoginPage;
      product: ProductPage;
      comparison: ComparisonPage;
      favorites: FavoritesPage;
      invoices: AccountInvoicesPage;
      invoiceDetails: InvoiceDetailsPage;
    },
  ) {}

  async signIn(customer: Pick<NewCustomer, 'email' | 'password'>): Promise<void> {
    await test.step('sign in', async () => {
      await this.pages.login.goto();
      await this.pages.login.login(customer.email, customer.password);
      await expect(this.page).toHaveURL(/\/account$/);
    });
  }

  /** Adds the product from its detail page and waits until the API has stored it. */
  async addToFavorites(product: Product): Promise<void> {
    await test.step(`add "${product.name}" to favourites`, async () => {
      await this.pages.product.goto(product.id);
      const stored = this.page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/favorites'));
      await this.pages.product.addToFavorites.click();
      expect((await stored).status(), 'POST /favorites').toBe(201);
    });
  }

  /** The product names on "My favorites". */
  async favorites(): Promise<string[]> {
    return test.step('open my favourites', async () => {
      await this.pages.favorites.goto();
      await expect(this.pages.favorites.productNames.first()).toBeVisible();
      return (await this.pages.favorites.productNames.allTextContents()).map((name) => name.trim());
    });
  }

  /** Marks each product for comparison, opens the comparison and returns the price shown per product name. */
  async compare(products: Product[]): Promise<Map<string, number>> {
    return test.step(`compare ${products.map((p) => `"${p.name}"`).join(' and ')}`, async () => {
      for (const product of products) {
        await this.pages.product.goto(product.id);
        await this.pages.product.addToCompare.click();
      }
      await this.pages.comparison.goto();
      await expect(this.pages.comparison.productNames).toHaveText(products.map((p) => p.name));
      const names = await this.pages.comparison.productNames.allTextContents();
      const prices = await this.pages.comparison.prices.allTextContents();
      return new Map(names.map((name, i) => [name.trim(), Number(prices[i].replace(/[^0-9.]/g, ''))]));
    });
  }

  /** Opens the invoice from "My invoices", waits until its PDF is ready and downloads it. */
  async downloadInvoice(invoiceNumber: string): Promise<{ fileName: string; body: Buffer }> {
    return test.step(`download the PDF of ${invoiceNumber}`, async () => {
      await this.pages.invoices.goto();
      await this.pages.invoices.details(invoiceNumber).click();
      const details = this.pages.invoiceDetails;
      await expect(details.invoiceNumber).toHaveValue(invoiceNumber);
      await expect(details.downloadPdf, 'the PDF is written in the background').toBeEnabled({ timeout: PDF_READY_TIMEOUT });

      const download = this.page.waitForEvent('download');
      await details.downloadPdf.click();
      const file = await download;
      return { fileName: file.suggestedFilename(), body: await readFile(await file.path()) };
    });
  }
}
