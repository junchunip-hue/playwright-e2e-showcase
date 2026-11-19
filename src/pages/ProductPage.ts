import type { Locator, Page } from '@playwright/test';

export class ProductPage {
  readonly name: Locator;
  readonly quantity: Locator;
  readonly addToCart: Locator;
  readonly addToFavorites: Locator;
  /** Toggles the product in the comparison (kept in sessionStorage, at most 4 products). */
  readonly addToCompare: Locator;

  constructor(private readonly page: Page) {
    this.name = page.getByTestId('product-name');
    this.quantity = page.getByTestId('quantity');
    this.addToCart = page.getByTestId('add-to-cart');
    this.addToFavorites = page.getByTestId('add-to-favorites');
    this.addToCompare = page.getByTestId('add-to-compare');
  }

  async goto(productId: string): Promise<void> {
    await this.page.goto(`/product/${productId}`);
  }
}
