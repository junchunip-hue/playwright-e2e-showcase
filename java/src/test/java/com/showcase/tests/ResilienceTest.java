package com.showcase.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Response;
import com.microsoft.playwright.Route;
import com.microsoft.playwright.assertions.LocatorAssertions;
import com.showcase.annotations.Negative;
import com.showcase.annotations.RegressionTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.pages.HomePage;
import java.net.URI;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Predicate;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;

/**
 * Mirrors tests/e2e/resilience.spec.ts (S6): what a customer sees when the backend is slow or fails, made
 * reproducible with page.route. Pinned behaviour: the app has no error state. A failed catalogue leaves the page
 * blank, and a failed search is shown as "no results" (findings in docs/test-plan.md).
 */
@ToolshopTest
@DisplayName("Resilience")
class ResilienceTest {
  /** GET /products (the catalogue list), not /products/{id} or /products/search. */
  private static final Predicate<String> CATALOGUE = url -> URI.create(url).getPath().endsWith("/products");
  private static final Predicate<String> SEARCH = url -> URI.create(url).getPath().endsWith("/products/search");

  private static void serverError(Route route) {
    route.fulfill(new Route.FulfillOptions().setStatus(500).setContentType("application/json")
        .setBody("{\"message\":\"Server Error\"}"));
  }

  @RegressionTest
  @DisplayName("S6: a slow catalogue response still shows the products once it arrives")
  void slowCatalogue(Page page) {
    AtomicInteger delayed = new AtomicInteger();
    page.route(CATALOGUE, route -> {
      // The real answer from Toolshop, copied into memory before the delay: the fetched response can be disposed
      // while we wait (TS on Firefox, nightly 2026-11-19: "Fetch response has been disposed"), which left the
      // request unanswered and the test hanging until its timeout.
      APIResponse response = route.fetch();
      Route.FulfillOptions answer = new Route.FulfillOptions()
          .setStatus(response.status())
          .setHeaders(response.headers())
          .setBodyBytes(response.body());
      try {
        Thread.sleep(3_000); // ...delivered 3 s late
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
      delayed.incrementAndGet();
      route.fulfill(answer);
    });
    HomePage homePage = new HomePage(page);

    homePage.open();

    // Web-first assertions wait for the late response; no fixed sleep in the test itself.
    assertThat(homePage.ui.productNames.first()).isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(10_000));
    assertThat(homePage.ui.noResults).isHidden();
    assertTrue(delayed.get() > 0, "the catalogue request went through the delay");
  }

  @RegressionTest
  @Negative
  @DisplayName("S6: a failed catalogue request shows no products and no error; a reload recovers")
  void failedCatalogue(Page page) {
    page.route(CATALOGUE, ResilienceTest::serverError);
    HomePage homePage = new HomePage(page);

    Response failed = page.waitForResponse(res -> CATALOGUE.test(res.url()), homePage::open);
    assertEquals(500, failed.status());

    // Finding: no error message, no "no results" either: the list is simply empty.
    assertThat(homePage.ui.productNames).hasCount(0);
    assertThat(homePage.ui.noResults).isHidden();

    page.unroute(CATALOGUE);
    page.reload();
    assertThat(homePage.ui.productNames.first()).isVisible();
  }

  @RegressionTest
  @Negative
  @DisplayName("S6: a failed search is shown as \"no results\"; the next search works")
  void failedSearch(Page page) {
    HomePage homePage = new HomePage(page);
    homePage.open();
    assertThat(homePage.ui.productNames.first()).isVisible();

    page.route(SEARCH, ResilienceTest::serverError);
    homePage.submitSearch("pliers");

    // Finding: the server error reaches the customer as "There are no products found".
    assertThat(homePage.ui.noResults).isVisible();
    assertThat(homePage.ui.productNames).hasCount(0);

    page.unroute(SEARCH);
    homePage.search("pliers");
    assertThat(homePage.ui.productNames.first()).containsText(Pattern.compile("pliers", Pattern.CASE_INSENSITIVE));
  }
}
