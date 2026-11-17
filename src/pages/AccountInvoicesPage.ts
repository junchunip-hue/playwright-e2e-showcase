import type { Locator, Page } from '@playwright/test';

/** "My invoices" of a signed-in customer (/account/invoices). The table has no data-test ids. */
export class AccountInvoicesPage {
  readonly title: Locator;
  readonly rows: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByTestId('page-title');
    this.rows = page.locator('table tbody tr');
  }

  async goto(): Promise<void> {
    await this.page.goto('/account/invoices');
  }

  row(invoiceNumber: string): Locator {
    return this.rows.filter({ hasText: invoiceNumber });
  }
}
