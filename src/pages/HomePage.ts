import type { Locator, Page } from '@playwright/test';

/** Product catalogue (landing page) with search. */
export class HomePage {
  readonly searchInput: Locator;
  readonly searchSubmit: Locator;
  readonly productNames: Locator;

  constructor(private readonly page: Page) {
    this.searchInput = page.getByTestId('search-query');
    this.searchSubmit = page.getByTestId('search-submit');
    this.productNames = page.getByTestId('product-name');
  }

  async goto(): Promise<void> {
    await this.page.goto('/');
  }

  /** Waits for the search API response so the result list is stable before assertions. */
  async search(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await Promise.all([
      this.page.waitForResponse((res) => res.url().includes('/products/search') && res.ok()),
      this.searchSubmit.click(),
    ]);
  }

  async openProduct(name: string): Promise<void> {
    await this.productNames.filter({ hasText: name }).first().click();
  }
}
