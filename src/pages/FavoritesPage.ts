import type { Locator, Page } from '@playwright/test';

/** "My favorites" of a signed-in customer (/account/favorites): one card per product. */
export class FavoritesPage {
  readonly title: Locator;
  readonly productNames: Locator;

  constructor(private readonly page: Page) {
    this.title = page.getByTestId('page-title');
    this.productNames = page.getByTestId('product-name');
  }

  async goto(): Promise<void> {
    await this.page.goto('/account/favorites');
  }
}
