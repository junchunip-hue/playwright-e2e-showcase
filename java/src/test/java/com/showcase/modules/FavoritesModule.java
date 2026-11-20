package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Module layer: "My favorites" (/account/favorites), one card per product. TypeScript twin: src/modules/account.module.ts. */
public class FavoritesModule {
  public final Locator title;
  public final Locator productNames;

  public FavoritesModule(Page page) {
    this.title = page.getByTestId("page-title");
    this.productNames = page.getByTestId("product-name");
  }
}
