package com.showcase.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.showcase.config.Env;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import com.showcase.pages.HomePage;
import com.showcase.pages.LoginPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.When;
import java.util.regex.Pattern;

/**
 * Steps layer: Gherkin sentences bound to page methods. Steps used by more than one feature live
 * here. TypeScript twin: src/steps/common.steps.ts. Wording and placement rules:
 * docs/coding-rules.md#gherkin-steps; every step: docs/steps.md.
 */
public class CommonSteps {
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;

  public CommonSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  @Given("a newly registered customer")
  public void aNewlyRegisteredCustomer() {
    ctx.customer = Customers.create(playwright.api());
  }

  @Given("a product that is in stock")
  public void aProductThatIsInStock() {
    ctx.product = playwright.api().findInStockProduct();
  }

  @Given("I have signed in as the demo customer on the login page")
  public void iHaveSignedInAsTheDemoCustomer() {
    LoginPage loginPage = new LoginPage(playwright.page());
    loginPage.open();
    loginPage.signIn(Env.CUSTOMER_EMAIL, Env.CUSTOMER_PASSWORD);
    assertThat(playwright.page()).hasURL(Pattern.compile("/account"));
  }

  @Given("I have signed in as that customer on the login page")
  public void iHaveSignedInAsThatCustomer() {
    Customer customer = ctx.customer();
    LoginPage loginPage = new LoginPage(playwright.page());
    loginPage.open();
    loginPage.signIn(customer.email(), customer.password());
    assertThat(playwright.page()).hasURL(Pattern.compile("/account$"));
  }

  /** The catalogue page is Toolshop's home page (pages/HomePage.java). */
  @Given("I open the catalogue page")
  public void iOpenTheCataloguePage() {
    new HomePage(playwright.page()).open();
  }

  @When("I search the catalogue page for {string}")
  public void iSearchTheCataloguePageFor(String term) {
    new HomePage(playwright.page()).search(term);
  }
}
