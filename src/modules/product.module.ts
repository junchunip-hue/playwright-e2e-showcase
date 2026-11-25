import type { Locator, Page } from '@playwright/test';

/** Module layer: locators of a product's detail page. Java twin: modules/ProductModule.java. */
export class ProductModule {
  /** The heading: the name, plus the ECO badge of an eco-friendly product (ProductPage.productName reads the name). */
  readonly name: Locator;
  readonly quantity: Locator;
  readonly addToCart: Locator;
  readonly addToFavorites: Locator;
  /** Toggles the product in the comparison (kept in sessionStorage, at most 4 products). */
  readonly addToCompare: Locator;

  constructor(page: Page) {
    this.name = page.getByTestId('product-name');
    this.quantity = page.getByTestId('quantity');
    this.addToCart = page.getByTestId('add-to-cart');
    this.addToFavorites = page.getByTestId('add-to-favorites');
    this.addToCompare = page.getByTestId('add-to-compare');
  }
}
