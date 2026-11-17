package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Negative;
import com.showcase.annotations.RegressionTest;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;

/**
 * Mirrors tests/api/registration.api.spec.ts (A4, A5): each test breaks exactly one rule on otherwise valid data
 * and checks that only that field is reported (pinned source: StoreCustomer request).
 */
@ToolshopTest
@DisplayName("Registration API")
class RegistrationApiTest {
  private static final String REGISTER = "POST /users/register";

  @SmokeTest
  @Negative
  @DisplayName("A4: weak password is rejected with every unmet rule")
  void weakPassword(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      APIResponse res = api.registerRequest(Customers.data(api, Map.of("password", "abc")));

      assertEquals(422, res.status());
      Map<String, List<String>> errors = api.validationErrors(res, REGISTER);
      assertEquals(Set.of("password"), errors.keySet());
      String messages = String.join(" | ", errors.get("password"));
      for (String rule : List.of("at least 8 characters", "uppercase and one lowercase", "at least one symbol", "at least one number")) {
        assertTrue(messages.contains(rule), "missing rule \"" + rule + "\" in: " + messages);
      }
    }
  }

  // The leak check calls the external Have I Been Pwned API from the Toolshop backend; Laravel lets the password
  // through when that service is unreachable. External dependency, so nightly rather than the PR gate.
  @RegressionTest
  @Negative
  @DisplayName("A4: password from a known data leak is rejected")
  void leakedPassword(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      // Satisfies every local rule, but appears in public breach lists.
      APIResponse res = api.registerRequest(Customers.data(api, Map.of("password", "Password1!")));

      assertEquals(422, res.status());
      Map<String, List<String>> errors = api.validationErrors(res, REGISTER);
      assertEquals(Set.of("password"), errors.keySet());
      assertEquals(1, errors.get("password").size());
      assertTrue(errors.get("password").get(0).contains("appeared in a data leak"), errors.get("password").get(0));
    }
  }

  // Toolshop answers 409 Conflict here, not 422: the duplicate is a state conflict, not malformed input.
  @SmokeTest
  @Negative
  @DisplayName("A5: duplicate email is rejected with 409")
  void duplicateEmail(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Customer existing = Customers.create(api);

      APIResponse res = api.registerRequest(Customers.data(api, Map.of("email", existing.email())));

      assertEquals(409, res.status());
      Map<String, List<String>> errors = api.validationErrors(res, REGISTER);
      assertEquals(Set.of("email"), errors.keySet());
      assertEquals(1, errors.get("email").size());
      assertTrue(errors.get("email").get(0).contains("already exists"), errors.get("email").get(0));
    }
  }
}
