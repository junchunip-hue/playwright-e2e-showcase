package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
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
import java.util.function.Function;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.function.Executable;

/**
 * Mirrors tests/api/invoices.api.spec.ts (A6): every invoice route needs a signed-in user. Each request is sent
 * without and with a valid token; the contrast shows the 401 comes from the missing token, not from the id. The ids do
 * not exist (authentication is checked first), so the test needs no order and reads nobody's data.
 */
@ToolshopTest
@DisplayName("Invoices API: authentication")
class InvoicesApiTest {
  private static final String UNKNOWN_ID = "01JAAAAAAAAAAAAAAAAAAAAAAA";
  private static final String UNKNOWN_NUMBER = "INV-2000000001";

  private record Route(String label, Function<String, APIResponse> send, int signedIn) {}

  @SmokeTest
  @Negative
  @DisplayName("A6: invoices cannot be read without a token")
  void invoicesNeedAToken(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Customer customer = Customers.create(api);
      String token = api.login(customer.email(), customer.password());

      List<Route> routes = List.of(
          new Route("GET /invoices", api::invoicesRequest, 200),
          new Route("GET /invoices/{id}", t -> api.invoiceRequest(UNKNOWN_ID, t), 404),
          new Route("GET /invoices/{number}/download-pdf", t -> api.invoicePdfRequest(UNKNOWN_NUMBER, t), 404),
          new Route("GET /invoices/{number}/download-pdf-status", t -> api.invoicePdfStatusRequest(UNKNOWN_NUMBER, t), 400));

      assertAll(routes.stream().map(route -> (Executable) () -> {
        APIResponse anonymous = route.send().apply(null);
        assertEquals(401, anonymous.status(), route.label() + " without a token");
        assertUnauthorized(anonymous, route.label());
        assertEquals(route.signedIn(), route.send().apply(token).status(), route.label() + " with a token");
      }));
    }
  }

  @RegressionTest
  @Negative
  @DisplayName("A6: a malformed token is refused like a missing one")
  void malformedTokenIsRefused(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      APIResponse res = api.invoicesRequest("not-a-jwt");

      assertEquals(401, res.status());
      assertUnauthorized(res, "GET /invoices with a malformed token");
    }
  }

  private static void assertUnauthorized(APIResponse res, String label) {
    JsonObject body = JsonParser.parseString(res.text()).getAsJsonObject();
    assertEquals("Unauthorized", body.get("message").getAsString(), label + ": body");
  }
}
