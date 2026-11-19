package com.showcase.pages;

import com.microsoft.playwright.Page;
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
}
