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

  /** Adds the product to the favourites and waits until the API has stored it (POST /favorites → 201). */
  async addToFavorites(): Promise<void> {
    const stored = this.page.waitForResponse((r) => r.request().method() === 'POST' && r.url().endsWith('/favorites'));
    await this.ui.addToFavorites.click();
    const status = (await stored).status();
    if (status !== 201) throw new Error(`POST /favorites answered ${status}`);
  }

  /** Marks the product for the comparison (kept in sessionStorage, at most 4 products). */
  async addToCompare(): Promise<void> {
    await this.ui.addToCompare.click();
  }
}
