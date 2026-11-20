package com.showcase.steps;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.showcase.pages.HomePage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.List;

/** Steps layer for features/ui/search.feature. TypeScript twin: src/steps/search.steps.ts. */
public class SearchSteps {
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;
  private HomePage homePage;

  public SearchSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  /** Built on first use: the browser page exists only once the @Before hook has run. */
  private HomePage homePage() {
    if (homePage == null) homePage = new HomePage(playwright.page());
    return homePage;
  }

  @Given("I am on the product catalogue")
  public void iAmOnTheProductCatalogue() {
    homePage().open();
  }

  @Given("the search API's results for {string}")
  public void theSearchApisResultsFor(String term) {
    ctx.searchApiNames =
        playwright.api().searchProducts(term).data().stream().map(p -> p.name().trim()).toList();
  }

  @When("I search for {string}")
  public void iSearchFor(String term) {
    homePage().search(term);
  }

  @Then("every product shown has {string} in its name")
  public void everyProductShownHasInItsName(String term) {
    List<String> names = homePage().productNames();
    assertFalse(names.isEmpty(), "no products shown");
    for (String name : names) {
      assertTrue(
          name.toLowerCase().contains(term.toLowerCase()), () -> "unexpected result: " + name);
    }
  }

  @Then("every product shown is one the search API returned")
  public void everyProductShownIsOneTheSearchApiReturned() {
    List<String> shown = homePage().productNames();
    assertFalse(shown.isEmpty(), "no products shown");
    assertTrue(
        ctx.searchApiNames().containsAll(shown),
        () ->
            "UI shows products the API did not return: UI "
                + shown
                + ", API "
                + ctx.searchApiNames());
  }
}
