package com.showcase.pages;

import com.microsoft.playwright.Page;
import com.showcase.modules.HomeModule;
import java.net.URI;
import java.util.List;

/**
 * Page layer: what a user does on the product catalogue. TypeScript twin: src/pages/home.page.ts.
 */
public class HomePage {
  private final Page page;

  /** The locators, for the steps' and tests' assertions. */
  public final HomeModule ui;

  public HomePage(Page page) {
    this.page = page;
    this.ui = new HomeModule(page);
  }

  public void open() {
    page.navigate("/");
  }

  public void reload() {
    page.reload();
  }

  /** Waits for the search API response so the result list is stable before assertions. */
  public void search(String term) {
    ui.searchInput.fill(term.strip());
    page.waitForResponse(
        res -> res.url().contains("/products/search") && res.ok(), ui.searchSubmit::click);
  }

  /**
   * Submits a search and waits for its response, whatever the status (for tests that make the
   * search fail).
   */
  public void submitSearch(String term) {
    ui.searchInput.fill(term);
    page.waitForResponse(
        res -> URI.create(res.url()).getPath().endsWith("/products/search"),
        ui.searchSubmit::click);
  }

  /** The product names in the result list, trimmed. */
  public List<String> productNames() {
    return ui.productNames.allTextContents().stream().map(String::trim).toList();
  }
}
