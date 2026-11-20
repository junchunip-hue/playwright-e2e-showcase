package com.showcase.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.assertions.LocatorAssertions;
import com.showcase.pages.HomePage;
import com.showcase.pages.NetworkPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.regex.Pattern;

/**
 * Steps layer for features/journeys/resilience.feature (S6). The mocking itself lives in
 * pages/NetworkPage. TypeScript twin: src/steps/resilience.steps.ts.
 */
public class ResilienceSteps {
  private final PlaywrightContext playwright;
  private NetworkPage network;
  private HomePage homePage;

  public ResilienceSteps(PlaywrightContext playwright) {
    this.playwright = playwright;
  }

  /** Built on first use: the browser page exists only once the @Before hook has run. */
  private NetworkPage network() {
    if (network == null) network = new NetworkPage(playwright.page());
    return network;
  }

  private HomePage homePage() {
    if (homePage == null) homePage = new HomePage(playwright.page());
    return homePage;
  }

  @Given("the catalogue answers {int} seconds late")
  public void theCatalogueAnswersSecondsLate(int seconds) {
    network().delayCatalogue(seconds * 1000);
  }

  @Given("the catalogue answers with a server error")
  public void theCatalogueAnswersWithAServerError() {
    network().failCatalogue();
  }

  @Given("the search answers with a server error")
  public void theSearchAnswersWithAServerError() {
    network().failSearch();
  }

  @When("the catalogue API works again")
  public void theCatalogueApiWorksAgain() {
    network().restoreCatalogue();
  }

  @When("I reload the catalogue page")
  public void iReloadTheCataloguePage() {
    homePage().reload();
  }

  @When("I submit a search for {string} on the catalogue page")
  public void iSubmitASearchFor(String term) {
    homePage().submitSearch(term); // waits for the (failing) answer, whatever its status
  }

  @When("the search API works again")
  public void theSearchApiWorksAgain() {
    network().restoreSearch();
  }

  // Web-first assertions wait for a late answer: up to 10 s, enough for the 3 s delay; no fixed
  // sleep.
  @Then("products are shown")
  public void productsAreShown() {
    assertThat(homePage().ui.productNames.first())
        .isVisible(new LocatorAssertions.IsVisibleOptions().setTimeout(10_000));
  }

  @Then("no products are shown")
  public void noProductsAreShown() {
    assertThat(homePage().ui.productNames).hasCount(0);
  }

  @Then("no {string} message is shown")
  public void noMessageIsShown(String message) {
    assertEquals("no results", message, "the only message this step knows");
    assertThat(homePage().ui.noResults).isHidden();
  }

  @Then("a {string} message is shown")
  public void aMessageIsShown(String message) {
    assertEquals("no results", message, "the only message this step knows");
    assertThat(homePage().ui.noResults).isVisible();
  }

  @Then("the catalogue answer went through the delay")
  public void theCatalogueAnswerWentThroughTheDelay() {
    assertTrue(network().delayed.get() > 0, "catalogue answers delivered late");
  }

  /**
   * Waits until the mocked 500 really reached the app, so "no products" is checked after the
   * failure (TS: expect.poll).
   */
  @Then("the catalogue request got the server error")
  public void theCatalogueRequestGotTheServerError() {
    long deadline = System.currentTimeMillis() + 5_000;
    while (network().catalogueFailures.get() == 0 && System.currentTimeMillis() < deadline) {
      playwright.page().waitForTimeout(100);
    }
    assertTrue(network().catalogueFailures.get() > 0, "catalogue requests answered with 500");
  }

  @Then("the first product shown has {string} in its name")
  public void theFirstProductShownHasInItsName(String term) {
    assertThat(homePage().ui.productNames.first())
        .containsText(
            Pattern.compile(
                term,
                Pattern.CASE_INSENSITIVE)); // sent to the browser as a JS regex: no \Q...\E quoting
  }
}
