package com.showcase.pages;

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Route;
import java.net.URI;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;

/**
 * Page layer: the network as the browser sees it, for S6 (network mocking). The browser's request
 * is held back or answered with a 500 before it reaches Toolshop, and released again to show
 * recovery. Each method also counts what it did, so a step can wait until the mocked answer really
 * reached the app. TypeScript twin: src/pages/network.page.ts.
 */
public class NetworkPage {
  /** GET /products (the catalogue list), not /products/{id} or /products/search. */
  private static final Predicate<String> CATALOGUE =
      url -> URI.create(url).getPath().endsWith("/products");

  private static final Predicate<String> SEARCH =
      url -> URI.create(url).getPath().endsWith("/products/search");

  private final Page page;

  /** Catalogue answers delivered late. */
  public final AtomicInteger delayed = new AtomicInteger();

  /** Catalogue requests answered with a 500. */
  public final AtomicInteger catalogueFailures = new AtomicInteger();

  public NetworkPage(Page page) {
    this.page = page;
  }

  public void delayCatalogue(int millis) {
    page.route(
        CATALOGUE,
        route -> {
          // The real answer, copied into memory before the delay: the fetched response can be
          // disposed while we wait
          // (TS on Firefox, nightly 2026-11-19: "Fetch response has been disposed").
          APIResponse response = route.fetch();
          Route.FulfillOptions answer =
              new Route.FulfillOptions()
                  .setStatus(response.status())
                  .setHeaders(response.headers())
                  .setBodyBytes(response.body());
          try {
            Thread.sleep(millis);
          } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
          }
          delayed.incrementAndGet();
          route.fulfill(answer);
        });
  }

  public void failCatalogue() {
    page.route(
        CATALOGUE,
        route -> {
          catalogueFailures.incrementAndGet();
          route.fulfill(serverError());
        });
  }

  public void restoreCatalogue() {
    page.unroute(CATALOGUE);
  }

  public void failSearch() {
    page.route(SEARCH, route -> route.fulfill(serverError()));
  }

  public void restoreSearch() {
    page.unroute(SEARCH);
  }

  private static Route.FulfillOptions serverError() {
    return new Route.FulfillOptions()
        .setStatus(500)
        .setContentType("application/json")
        .setBody("{\"message\":\"Server Error\"}");
  }
}
