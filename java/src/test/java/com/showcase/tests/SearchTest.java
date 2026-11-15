package com.showcase.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.junit.UsePlaywright;
import com.showcase.config.ToolshopOptions;
import com.showcase.pages.HomePage;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** Mirrors the @smoke case in tests/ui/search.spec.ts. */
@UsePlaywright(ToolshopOptions.class)
@DisplayName("Product search")
class SearchTest {

  @Test
  @Tag("smoke")
  @DisplayName("every result matches the search term")
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
}
