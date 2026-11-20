package com.showcase.steps.api;

import static com.showcase.steps.ScenarioContext.need;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.microsoft.playwright.APIResponse;
import com.showcase.api.ApiClient;
import com.showcase.data.Customers.Customer;
import com.showcase.steps.PlaywrightContext;
import com.showcase.steps.ScenarioContext;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.Map;
import java.util.function.Function;
import org.junit.jupiter.api.function.Executable;

/**
 * Steps layer for features/api/invoices.feature (A6). TypeScript twin:
 * src/steps/api/invoices.steps.ts.
 */
public class InvoicesApiSteps {
  /**
   * Ids that do not exist: authentication is checked before the lookup, so any id shows where the
   * 401 comes from.
   */
  private static final String UNKNOWN_ID = "01JAAAAAAAAAAAAAAAAAAAAAAA";

  private static final String UNKNOWN_NUMBER = "INV-2000000001";
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;

  public InvoicesApiSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  private ApiClient api() {
    return playwright.api();
  }

  private String customerToken() {
    Customer customer = ctx.customer();
    return api().login(customer.email(), customer.password());
  }

  @Then(
      "every invoice route refuses an anonymous request with 401 and lets the signed-in one through")
  public void everyInvoiceRouteRefusesAnAnonymousRequest(DataTable table) {
    String token = customerToken();
    Map<String, Function<String, APIResponse>> send =
        Map.of(
            "GET /invoices", t -> api().invoicesRequest(t),
            "GET /invoices/{id}", t -> api().invoiceRequest(UNKNOWN_ID, t),
            "GET /invoices/{number}/download-pdf", t -> api().invoicePdfRequest(UNKNOWN_NUMBER, t),
            "GET /invoices/{number}/download-pdf-status",
                t -> api().invoicePdfStatusRequest(UNKNOWN_NUMBER, t));
    assertAll(
        table.asMaps().stream()
            .map(row ->
                (Executable)
                    () -> {
                      String label = row.get("route");
                      Function<String, APIResponse> route =
                          need(
                              send.get(label),
                              "a request for \"" + label + "\" in InvoicesApiSteps");
                      APIResponse anonymous = route.apply(null);
                      assertEquals(401, anonymous.status(), label + " without a token");
                      assertUnauthorized(anonymous, label);
                      assertEquals(
                          Integer.parseInt(row.get("signed in")),
                          route.apply(token).status(),
                          label + " with a token");
                    }));
  }

  @When("I list invoices with the token {string}")
  public void iListInvoicesWithTheToken(String token) {
    ctx.response = api().invoicesRequest(token);
  }

  @Then("the API answers 401 with the Unauthorized message")
  public void theApiAnswers401Unauthorized() {
    APIResponse res = need(ctx.response, "When I list invoices with the token \"...\"");
    assertEquals(401, res.status());
    assertUnauthorized(res, "GET /invoices with a malformed token");
  }

  private static void assertUnauthorized(APIResponse res, String label) {
    JsonObject body = JsonParser.parseString(res.text()).getAsJsonObject();
    assertEquals("Unauthorized", body.get("message").getAsString(), label + ": body");
  }
}
