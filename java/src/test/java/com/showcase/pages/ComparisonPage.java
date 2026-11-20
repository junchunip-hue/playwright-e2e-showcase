package com.showcase.pages;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import com.showcase.modules.ComparisonModule;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Page layer: the side-by-side comparison. TypeScript twin: src/pages/account.page.ts. */
public class ComparisonPage {
  private final Page page;
  public final ComparisonModule ui;

  public ComparisonPage(Page page) {
    this.page = page;
    this.ui = new ComparisonModule(page);
  }

  public void open() {
    page.navigate("/comparison");
  }

  /** The price shown per product name, once exactly these products are in the comparison. */
  public Map<String, Double> pricesOf(List<String> productNames) {
    assertThat(ui.productNames).hasText(productNames.toArray(String[]::new));
    List<String> names = ui.productNames.allTextContents();
    List<String> prices = ui.prices.allTextContents();
    Map<String, Double> shown = new LinkedHashMap<>();
    for (int i = 0; i < names.size(); i++) {
      shown.put(names.get(i).trim(), Double.parseDouble(prices.get(i).replaceAll("[^0-9.]", "")));
    }
    return shown;
  }
}
