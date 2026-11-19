import type { Locator, Page } from '@playwright/test';

/** Side-by-side comparison of the products chosen with "Compare" (/comparison): one column per product. */
export class ComparisonPage {
  readonly table: Locator;
  readonly productNames: Locator;
  readonly prices: Locator;

  constructor(private readonly page: Page) {
    this.table = page.getByTestId('comparison-table');
    this.productNames = this.table.getByTestId('product-name');
    this.prices = this.table.getByTestId('compare-price');
  }

  async goto(): Promise<void> {
    await this.page.goto('/comparison');
  }
}
