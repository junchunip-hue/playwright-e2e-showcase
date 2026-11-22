package com.showcase.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.showcase.modules.HeaderModule;
import com.showcase.pages.ProductPage;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

/** Steps layer for features/ui/cart.feature. TypeScript twin: src/steps/cart.steps.ts. */
public class CartSteps {
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;
  private ProductPage productPage;

  public CartSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  /**
   * Built on first use: the first call opens the scenario's browser page (PlaywrightContext#page).
   */
  private ProductPage productPage() {
    if (productPage == null) productPage = new ProductPage(playwright.page());
    return productPage;
  }

  @When("I open that product's page")
  public void iOpenThatProductsPage() {
    productPage().open(ctx.product().id());
  }

  @Then("the product page shows that product")
  public void thePageShowsThatProduct() {
    assertThat(productPage().ui.name).hasText(ctx.product().name());
  }

  @When("I add it to the cart on the product page")
  public void iAddItToTheCartOnTheProductPage() {
    productPage().addToCart();
  }

  @Then("the cart badge shows {int}")
  public void theCartBadgeShows(int count) {
    assertThat(new HeaderModule(playwright.page()).cartQuantity).hasText(String.valueOf(count));
  }
}
