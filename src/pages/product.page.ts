import { expect, type Page } from '@playwright/test';

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

  /**
   * The product's name, once the page shows it. Toolshop puts the ECO badge of an eco-friendly product inside the
   * same heading, so only the heading's own text counts, not that of its child elements.
   */
  async productName(): Promise<string> {
    await expect(this.ui.name).toBeVisible();
    const ownText = await this.ui.name.evaluate((heading) =>
      Array.from(heading.childNodes)
        .filter((node) => node.nodeType === Node.TEXT_NODE)
        .map((node) => node.textContent)
        .join(''),
    );
    return ownText.trim();
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
