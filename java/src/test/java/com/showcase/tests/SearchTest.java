package com.showcase.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.RegressionTest;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Product;
import com.showcase.pages.HomePage;
import java.util.List;
import org.junit.jupiter.api.DisplayName;

/** Mirrors tests/ui/search.spec.ts (U3, U4). */
@ToolshopTest
@DisplayName("Product search")
class SearchTest {

  @SmokeTest
  @DisplayName("U3: every result matches the search term")
  void resultsMatchTerm(Page page) {
    HomePage homePage = new HomePage(page);
    homePage.navigate();
    homePage.search("pliers");

    assertThat(homePage.productNames.first()).isVisible();
    List<String> names = homePage.productNames.allTextContents();
    assertFalse(names.isEmpty(), "search returned no products");
    for (String name : names) {
      assertTrue(name.toLowerCase().contains("pliers"), () -> "unexpected result: " + name);
    }
  }

  // Hybrid check: the UI must show what the backend returns (catches frontend filtering bugs).
  @RegressionTest
  @DisplayName("U4: UI results are consistent with the search API")
  void uiMatchesApi(Page page, Playwright playwright) {
    List<String> apiNames;
    try (ApiClient api = ApiClient.create(playwright)) {
      apiNames = api.searchProducts("hammer").data().stream().map(p -> p.name().trim()).toList();
    }

    HomePage homePage = new HomePage(page);
    homePage.navigate();
    homePage.search("hammer");
    List<String> uiNames = homePage.productNames.allTextContents().stream().map(String::trim).toList();

    assertFalse(uiNames.isEmpty(), "search returned no products in the UI");
    assertTrue(apiNames.containsAll(uiNames), () -> "UI shows products the API did not return: UI " + uiNames + ", API " + apiNames);
  }
}
