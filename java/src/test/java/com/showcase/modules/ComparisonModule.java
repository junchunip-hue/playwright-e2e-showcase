package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Module layer: the side-by-side comparison (/comparison), one column per product. TypeScript twin:
 * src/modules/account.module.ts.
 */
public class ComparisonModule {
  public final Locator table;
  public final Locator productNames;
  public final Locator prices;

  public ComparisonModule(Page page) {
    this.table = page.getByTestId("comparison-table");
    this.productNames = table.getByTestId("product-name");
    this.prices = table.getByTestId("compare-price");
  }
}
