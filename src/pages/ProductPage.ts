import type { Locator, Page } from '@playwright/test';

export class ProductPage {
  readonly name: Locator;
  readonly quantity: Locator;
  readonly addToCart: Locator;

  constructor(private readonly page: Page) {
    this.name = page.getByTestId('product-name');
    this.quantity = page.getByTestId('quantity');
    this.addToCart = page.getByTestId('add-to-cart');
  }

  async goto(productId: string): Promise<void> {
    await this.page.goto(`/product/${productId}`);
  }
}
