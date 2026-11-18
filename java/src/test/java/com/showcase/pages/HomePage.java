package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;
import java.net.URI;

/** Java twin of src/pages/HomePage.ts: product catalogue (landing page) with search. */
public class HomePage {
  private final Page page;
  public final Locator searchInput;
  public final Locator searchSubmit;
  public final Locator productNames;
  /** "There are no products found." under the result list. */
  public final Locator noResults;

  public HomePage(Page page) {
    this.page = page;
    this.searchInput = page.getByTestId("search-query");
    this.searchSubmit = page.getByTestId("search-submit");
    this.productNames = page.getByTestId("product-name");
    this.noResults = page.getByTestId("no-results");
  }

  public void navigate() {
    page.navigate("/");
  }

  /** Waits for the search API response so the result list is stable before assertions. */
  public void search(String term) {
    searchInput.fill(term);
    page.waitForResponse(res -> res.url().contains("/products/search") && res.ok(), searchSubmit::click);
  }

  /** Submits a search and waits for its response, whatever the status (for tests that make the search fail). */
  public void submitSearch(String term) {
    searchInput.fill(term);
    page.waitForResponse(res -> URI.create(res.url()).getPath().endsWith("/products/search"), searchSubmit::click);
  }
}
