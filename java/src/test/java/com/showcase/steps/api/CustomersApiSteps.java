package com.showcase.steps.api;

import static com.showcase.steps.ScenarioContext.need;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.showcase.api.ApiClient;
import com.showcase.config.Env;
import com.showcase.data.Customers;
import com.showcase.steps.PlaywrightContext;
import com.showcase.steps.ScenarioContext;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Steps layer for features/api/auth.feature, registration.feature and the postcode part of contracts.feature.
 * TypeScript twin: src/steps/api/customers.steps.ts.
 */
public class CustomersApiSteps {
  private static final String REGISTER = "POST /users/register";
  private static final String RESPONSE = "a When step that sends the request";
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;
  private String token;
  private Map<String, String> address;

  public CustomersApiSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  private ApiClient api() {
    return playwright.api();
  }

  private Map<String, List<String>> registrationErrors() {
    return api().validationErrors(need(ctx.response, RESPONSE), REGISTER);
  }

  @When("the demo customer signs in through the API")
  public void theDemoCustomerSignsInThroughTheApi() {
    token = api().login(Env.CUSTOMER_EMAIL, Env.CUSTOMER_PASSWORD);
  }

  @Then("an access token is returned")
  public void anAccessTokenIsReturned() {
    assertFalse(token == null || token.isBlank(), "access token");
  }

  @When("that customer signs in through the API with a wrong password")
  public void thatCustomerSignsInWithAWrongPassword() {
    ctx.response = api().loginRequest(ctx.customer().email(), "definitely-wrong-password");
  }

  @Then("the API answers {int}")
  public void theApiAnswers(int status) {
    assertEquals(status, need(ctx.response, RESPONSE).status());
  }

  @When("I register a new customer with the password {string}")
  public void iRegisterANewCustomerWithThePassword(String password) {
    ctx.response = api().registerRequest(Customers.data(api(), Map.of("password", password)));
  }

  @When("I register another customer with the same email")
  public void iRegisterAnotherCustomerWithTheSameEmail() {
    ctx.response = api().registerRequest(Customers.data(api(), Map.of("email", ctx.customer().email())));
  }

  @Then("only the password is rejected, for every unmet rule")
  public void onlyThePasswordIsRejectedForEveryUnmetRule() {
    Map<String, List<String>> errors = registrationErrors();
    assertEquals(Set.of("password"), errors.keySet());
    String messages = String.join(" | ", errors.get("password"));
    for (String rule : List.of("at least 8 characters", "uppercase and one lowercase", "at least one symbol", "at least one number")) {
      assertTrue(messages.contains(rule), "missing rule \"" + rule + "\" in: " + messages);
    }
  }

  @Then("only the password is rejected, as having appeared in a data leak")
  public void onlyThePasswordIsRejectedAsLeaked() {
    Map<String, List<String>> errors = registrationErrors();
    assertEquals(Set.of("password"), errors.keySet());
    assertEquals(1, errors.get("password").size());
    assertTrue(errors.get("password").get(0).contains("appeared in a data leak"), errors.get("password").get(0));
  }

  @Then("only the email is rejected, as already existing")
  public void onlyTheEmailIsRejectedAsAlreadyExisting() {
    Map<String, List<String>> errors = registrationErrors();
    assertEquals(Set.of("email"), errors.keySet());
    assertEquals(1, errors.get("email").size());
    assertTrue(errors.get("email").get(0).contains("already exists"), errors.get("email").get(0));
  }

  @When("I look up the US postcode {string}")
  public void iLookUpTheUsPostcode(String postcode) {
    address = api().lookupAddress("US", postcode, "1");
  }

  @Then("the address is in country {string} with postcode {string}")
  public void theAddressIsInCountryWithPostcode(String country, String postcode) {
    assertEquals(country, address.get("country"));
    assertEquals(postcode, address.get("postal_code"));
  }
}
