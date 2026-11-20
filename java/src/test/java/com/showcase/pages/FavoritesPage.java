package com.showcase.pages;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import com.showcase.modules.FavoritesModule;
import java.util.List;

/** Page layer: "My favorites" of a signed-in customer. TypeScript twin: src/pages/account.page.ts. */
public class FavoritesPage {
  private final Page page;
  public final FavoritesModule ui;

  public FavoritesPage(Page page) {
    this.page = page;
    this.ui = new FavoritesModule(page);
  }

  public void open() {
    page.navigate("/account/favorites");
  }

  /** The product names listed, once the list has loaded. */
  public List<String> productNames() {
    assertThat(ui.productNames.first()).isVisible();
    return ui.productNames.allTextContents().stream().map(String::trim).toList();
  }
}
