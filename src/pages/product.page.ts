import type { Page } from '@playwright/test';
import { ProductModule } from '../modules/product.module';

/** Page layer: what a user does on a product's detail page. Java twin: pages/ProductPage.java. */
export class ProductPage {
  /** The locators, for the steps' and specs' assertions. */
  readonly ui: ProductModule;

  constructor(private readonly page: Page) {
    this.ui = new ProductModule(page);
  }

  async open(productId: string): Promise<void> {
    await this.page.goto(`/product/${productId}`);
  }

  async addToCart(): Promise<void> {
    await this.ui.addToCart.click();
  }
}
