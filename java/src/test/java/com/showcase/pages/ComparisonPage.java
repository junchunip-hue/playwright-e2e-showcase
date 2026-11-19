package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Java twin of src/pages/ComparisonPage.ts: one column per compared product (/comparison). */
public class ComparisonPage {
  private final Page page;
  public final Locator table;
  public final Locator productNames;
  public final Locator prices;

  public ComparisonPage(Page page) {
    this.page = page;
    this.table = page.getByTestId("comparison-table");
    this.productNames = table.getByTestId("product-name");
    this.prices = table.getByTestId("compare-price");
  }

  public void navigate() {
    page.navigate("/comparison");
  }
}
