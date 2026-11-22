import type { Page } from '@playwright/test';

import { HomeModule } from '../modules/home.module';

/** Page layer: what a user does on the product catalogue. Java twin: pages/HomePage.java. */
export class HomePage {
  /** The locators, for the steps' and specs' assertions. */
  readonly ui: HomeModule;

  constructor(private readonly page: Page) {
    this.ui = new HomeModule(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/');
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  /** Waits for the search API response so the result list is stable before assertions. */
  async search(term: string): Promise<void> {
    await this.ui.searchInput.fill(term.trim());
    await Promise.all([
      this.page.waitForResponse((res) => res.url().includes('/products/search') && res.ok()),
      this.ui.searchSubmit.click(),
    ]);
  }

  /** Submits a search and waits for its response, whatever the status (for tests that make the search fail). */
  async submitSearch(term: string): Promise<void> {
    await this.ui.searchInput.fill(term);
    await Promise.all([
      this.page.waitForResponse((res) => new URL(res.url()).pathname.endsWith('/products/search')),
      this.ui.searchSubmit.click(),
    ]);
  }

  async openProduct(name: string): Promise<void> {
    await this.ui.productNames.filter({ hasText: name }).first().click();
  }

  /** The product names in the result list, trimmed. */
  async productNames(): Promise<string[]> {
    return (await this.ui.productNames.allTextContents()).map((n) => n.trim());
  }
}
