import type { Locator, Page } from '@playwright/test';

/** Product catalogue (landing page) with search. */
export class HomePage {
  readonly searchInput: Locator;
  readonly searchSubmit: Locator;
  readonly productNames: Locator;
  /** "There are no products found." under the result list. */
  readonly noResults: Locator;
  /** Sort, price, search and category/brand filters in the sidebar. */
  readonly filtersPanel: Locator;

  constructor(private readonly page: Page) {
    this.searchInput = page.getByTestId('search-query');
    this.searchSubmit = page.getByTestId('search-submit');
    this.productNames = page.getByTestId('product-name');
    this.noResults = page.getByTestId('no-results');
    // data-test="filters" is on both the mobile toggle button and the panel itself.
    this.filtersPanel = page.locator('div[data-test="filters"]');
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

  /** Submits a search and waits for its response, whatever the status (for tests that make the search fail). */
  async submitSearch(term: string): Promise<void> {
    await this.searchInput.fill(term);
    await Promise.all([
      this.page.waitForResponse((res) => new URL(res.url()).pathname.endsWith('/products/search')),
      this.searchSubmit.click(),
    ]);
  }

  async openProduct(name: string): Promise<void> {
    await this.productNames.filter({ hasText: name }).first().click();
  }
}
