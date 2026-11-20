import type { Locator, Page } from '@playwright/test';

// Module layer: locators of a signed-in customer's account pages. Java twins: modules/FavoritesModule.java,
// ComparisonModule.java, InvoicesModule.java, InvoiceDetailsModule.java.

/** "My favorites" (/account/favorites): one card per product. */
export class FavoritesModule {
  readonly title: Locator;
  readonly productNames: Locator;

  constructor(page: Page) {
    this.title = page.getByTestId('page-title');
    this.productNames = page.getByTestId('product-name');
  }
}

/** Side-by-side comparison of the products chosen with "Compare" (/comparison): one column per product. */
export class ComparisonModule {
  readonly table: Locator;
  readonly productNames: Locator;
  readonly prices: Locator;

  constructor(page: Page) {
    this.table = page.getByTestId('comparison-table');
    this.productNames = this.table.getByTestId('product-name');
    this.prices = this.table.getByTestId('compare-price');
  }
}

/** "My invoices" (/account/invoices). The table has no data-test ids. */
export class InvoicesModule {
  readonly title: Locator;
  readonly rows: Locator;

  constructor(page: Page) {
    this.title = page.getByTestId('page-title');
    this.rows = page.locator('table tbody tr');
  }

  row(invoiceNumber: string): Locator {
    return this.rows.filter({ hasText: invoiceNumber });
  }

  /** The row's "Details" link (a router link without data-test). */
  details(invoiceNumber: string): Locator {
    return this.row(invoiceNumber).getByRole('link');
  }
}

/**
 * One invoice (/account/invoices/{id}). The download button stays disabled until the background job has written
 * the PDF; the page asks for its status every 20 seconds.
 */
export class InvoiceDetailsModule {
  readonly invoiceNumber: Locator;
  readonly downloadPdf: Locator;

  constructor(page: Page) {
    this.invoiceNumber = page.getByTestId('invoice-number');
    this.downloadPdf = page.getByTestId('download-invoice');
  }
}
