package com.showcase.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.showcase.config.Env;
import com.showcase.data.Customers;
import com.showcase.pages.LoginPage;
import io.cucumber.java.en.Given;
import java.util.regex.Pattern;

/**
 * Steps layer: Gherkin sentences bound to page methods. Steps used by more than one feature live here.
 * TypeScript twin: src/steps/common.steps.ts.
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

  @Given("I am signed in as the demo customer")
  public void iAmSignedInAsTheDemoCustomer() {
    LoginPage loginPage = new LoginPage(playwright.page());
    loginPage.open();
    loginPage.signIn(Env.CUSTOMER_EMAIL, Env.CUSTOMER_PASSWORD);
    assertThat(playwright.page()).hasURL(Pattern.compile("/account"));
  }
}
