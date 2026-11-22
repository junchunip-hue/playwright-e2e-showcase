package com.showcase.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.showcase.config.Env;
import com.showcase.modules.HeaderModule;
import com.showcase.pages.LoginPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.regex.Pattern;

/**
 * Steps layer for features/ui/login.feature: each step calls one page method or asserts on the
 * page's module ({@code loginPage.ui}). No locators are created here. TypeScript twin:
 * src/steps/login.steps.ts.
 */
public class LoginSteps {
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;
  private LoginPage loginPage;

  public LoginSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  /**
   * Built on first use: the first call opens the scenario's browser page (PlaywrightContext#page).
   */
  private LoginPage loginPage() {
    if (loginPage == null) loginPage = new LoginPage(playwright.page());
    return loginPage;
  }

  @Given("I open the login page")
  public void iAmOnTheLoginPage() {
    loginPage().open();
  }

  @When("I sign in as the demo customer on the login page")
  public void iSignInAsTheDemoCustomer() {
    loginPage().signIn(Env.CUSTOMER_EMAIL, Env.CUSTOMER_PASSWORD);
  }

  @When("I sign in as that customer with a wrong password on the login page")
  public void iSignInWithAWrongPassword() {
    loginPage().signIn(ctx.customer().email(), "definitely-wrong-password");
  }

  @Then("I am on my account page")
  public void iAmOnMyAccountPage() {
    assertThat(playwright.page()).hasURL(Pattern.compile("/account"));
  }

  @Then("the header shows my user menu")
  public void theHeaderShowsMyUserMenu() {
    assertThat(new HeaderModule(playwright.page()).userMenu).isVisible();
  }

  @Then("I see a login error")
  public void iSeeALoginError() {
    assertThat(loginPage().ui.error).isVisible();
  }

  @Then("I am still on the login page")
  public void iAmStillOnTheLoginPage() {
    assertThat(playwright.page()).hasURL(Pattern.compile("/auth/login"));
  }
}
