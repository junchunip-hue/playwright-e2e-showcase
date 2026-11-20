package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Module layer: locators of the product catalogue (landing page) with search. TypeScript twin:
 * src/modules/home.module.ts.
 */
public class HomeModule {
  public final Locator searchInput;
  public final Locator searchSubmit;
  public final Locator productNames;

  /** "There are no products found." under the result list. */
  public final Locator noResults;

  public HomeModule(Page page) {
    this.searchInput = page.getByTestId("search-query");
    this.searchSubmit = page.getByTestId("search-submit");
    this.productNames = page.getByTestId("product-name");
    this.noResults = page.getByTestId("no-results");
  }
}
