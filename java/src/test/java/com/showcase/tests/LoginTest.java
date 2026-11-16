package com.showcase.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Negative;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.config.Env;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import com.showcase.pages.Header;
import com.showcase.pages.LoginPage;
import java.util.regex.Pattern;
import org.junit.jupiter.api.DisplayName;

/** Mirrors tests/ui/login.spec.ts. Each test gets a fresh, logged-out browser context. */
@ToolshopTest
@DisplayName("Login")
class LoginTest {

  @SmokeTest
  @DisplayName("customer can log in with valid credentials")
  void validLogin(Page page) {
    LoginPage loginPage = new LoginPage(page);
    loginPage.navigate();
    loginPage.login(Env.CUSTOMER_EMAIL, Env.CUSTOMER_PASSWORD);

    assertThat(page).hasURL(Pattern.compile("/account"));
    assertThat(new Header(page).userMenu).isVisible();
  }

  @SmokeTest
  @Negative
  @DisplayName("shows an error for a wrong password")
  void wrongPassword(Page page, Playwright playwright) {
    // Failed logins count towards an account lock (HTTP 423): use a throwaway account, never the shared one.
    Customer customer;
    try (ApiClient api = ApiClient.create(playwright)) {
      customer = Customers.create(api);
    }

    LoginPage loginPage = new LoginPage(page);
    loginPage.navigate();
    loginPage.login(customer.email(), "definitely-wrong-password");

    assertThat(loginPage.error).isVisible();
    assertThat(page).hasURL(Pattern.compile("/auth/login"));
  }
}
