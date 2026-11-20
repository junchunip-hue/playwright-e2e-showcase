package com.showcase.pages;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.showcase.modules.ProductModule;

/** Page layer: what a user does on a product's detail page. TypeScript twin: src/pages/product.page.ts. */
public class ProductPage {
  private final Page page;
  /** The locators, for the steps' and tests' assertions. */
  public final ProductModule ui;

  public ProductPage(Page page) {
    this.page = page;
    this.ui = new ProductModule(page);
  }

  public void open(String productId) {
    page.navigate("/product/" + productId);
  }

  public void addToCart() {
    ui.addToCart.click();
  }

  /** Adds the product to the favourites and waits until the API has stored it (POST /favorites → 201). */
  public void addToFavorites() {
    Response stored = page.waitForResponse(
        r -> "POST".equals(r.request().method()) && r.url().endsWith("/favorites"), ui.addToFavorites::click);
    if (stored.status() != 201) throw new AssertionError("POST /favorites answered " + stored.status());
  }

  /** Marks the product for the comparison (kept in sessionStorage, at most 4 products). */
  public void addToCompare() {
    ui.addToCompare.click();
  }
}
