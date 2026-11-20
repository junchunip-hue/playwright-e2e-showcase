import { readFile } from 'node:fs/promises';
import { expect, type Page } from '@playwright/test';
import { ComparisonModule, FavoritesModule, InvoiceDetailsModule, InvoicesModule } from '../modules/account.module';

// Page layer: what a signed-in customer does on their account pages. Java twins: pages/FavoritesPage.java,
// ComparisonPage.java, InvoicesPage.java, InvoiceDetailsPage.java.

/** How long the invoice PDF may take: a background job writes it, and the page polls its status every 20 s. */
const PDF_READY_TIMEOUT = 180_000;

export class FavoritesPage {
  readonly ui: FavoritesModule;

  constructor(private readonly page: Page) {
    this.ui = new FavoritesModule(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/account/favorites');
  }

  /** The product names listed, once the list has loaded. */
  async productNames(): Promise<string[]> {
    await expect(this.ui.productNames.first()).toBeVisible();
    return (await this.ui.productNames.allTextContents()).map((name) => name.trim());
  }
}

export class ComparisonPage {
  readonly ui: ComparisonModule;

  constructor(private readonly page: Page) {
    this.ui = new ComparisonModule(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/comparison');
  }

  /** The price shown per product name, once exactly these products are in the comparison. */
  async pricesOf(productNames: string[]): Promise<Map<string, number>> {
    await expect(this.ui.productNames).toHaveText(productNames);
    const names = await this.ui.productNames.allTextContents();
    const prices = await this.ui.prices.allTextContents();
    return new Map(names.map((name, i) => [name.trim(), Number(prices[i].replace(/[^0-9.]/g, ''))]));
  }
}

export class InvoicesPage {
  readonly ui: InvoicesModule;

  constructor(private readonly page: Page) {
    this.ui = new InvoicesModule(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/account/invoices');
  }

  async openDetails(invoiceNumber: string): Promise<void> {
    await this.ui.details(invoiceNumber).click();
  }
}

export class InvoiceDetailsPage {
  readonly ui: InvoiceDetailsModule;

  constructor(private readonly page: Page) {
    this.ui = new InvoiceDetailsModule(page);
  }

  /** Waits until the background job has written the PDF (the button turns enabled), then downloads it. */
  async downloadPdf(invoiceNumber: string): Promise<{ fileName: string; body: Buffer }> {
    await expect(this.ui.invoiceNumber).toHaveValue(invoiceNumber);
    await expect(this.ui.downloadPdf, 'the PDF is written in the background').toBeEnabled({ timeout: PDF_READY_TIMEOUT });
    const download = this.page.waitForEvent('download');
    await this.ui.downloadPdf.click();
    const file = await download;
    return { fileName: file.suggestedFilename(), body: await readFile(await file.path()) };
  }
}
