package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Java twin of src/pages/ProductPage.ts. */
public class ProductPage {
  private final Page page;
  public final Locator name;
  public final Locator addToCart;

  public ProductPage(Page page) {
    this.page = page;
    this.name = page.getByTestId("product-name");
    this.addToCart = page.getByTestId("add-to-cart");
  }

  public void navigate(String productId) {
    page.navigate("/product/" + productId);
  }
}
