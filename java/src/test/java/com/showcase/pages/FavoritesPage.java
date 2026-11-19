package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Java twin of src/pages/FavoritesPage.ts: "My favorites" of a signed-in customer. */
public class FavoritesPage {
  private final Page page;
  public final Locator title;
  public final Locator productNames;

  public FavoritesPage(Page page) {
    this.page = page;
    this.title = page.getByTestId("page-title");
    this.productNames = page.getByTestId("product-name");
  }

  public void navigate() {
    page.navigate("/account/favorites");
  }
}
