package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Module layer: locators of a product's detail page. TypeScript twin: src/modules/product.module.ts. */
public class ProductModule {
  public final Locator name;
  public final Locator addToCart;
  public final Locator addToFavorites;
  /** Toggles the product in the comparison (kept in sessionStorage, at most 4 products). */
  public final Locator addToCompare;

  public ProductModule(Page page) {
    this.name = page.getByTestId("product-name");
    this.addToCart = page.getByTestId("add-to-cart");
    this.addToFavorites = page.getByTestId("add-to-favorites");
    this.addToCompare = page.getByTestId("add-to-compare");
  }
}
