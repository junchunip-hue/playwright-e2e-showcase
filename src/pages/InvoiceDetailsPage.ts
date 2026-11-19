import type { Locator, Page } from '@playwright/test';

/**
 * One invoice of a signed-in customer (/account/invoices/{id}). The download button stays disabled until the
 * background job has written the PDF; the page asks for its status every 20 seconds.
 */
export class InvoiceDetailsPage {
  readonly invoiceNumber: Locator;
  readonly downloadPdf: Locator;

  constructor(page: Page) {
    this.invoiceNumber = page.getByTestId('invoice-number');
    this.downloadPdf = page.getByTestId('download-invoice');
  }
}
