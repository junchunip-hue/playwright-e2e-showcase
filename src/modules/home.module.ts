import type { Locator, Page } from '@playwright/test';

/** Module layer: locators of the product catalogue (landing page) with search. Java twin: modules/HomeModule.java. */
export class HomeModule {
  readonly searchInput: Locator;
  readonly searchSubmit: Locator;
  readonly productNames: Locator;
  /** "There are no products found." under the result list. */
  readonly noResults: Locator;
  /** Sort, price, search and category/brand filters in the sidebar. */
  readonly filtersPanel: Locator;

  constructor(page: Page) {
    this.searchInput = page.getByTestId('search-query');
    this.searchSubmit = page.getByTestId('search-submit');
    this.productNames = page.getByTestId('product-name');
    this.noResults = page.getByTestId('no-results');
    // data-test="filters" is on both the mobile toggle button and the panel itself.
    this.filtersPanel = page.locator('div[data-test="filters"]');
  }
}
