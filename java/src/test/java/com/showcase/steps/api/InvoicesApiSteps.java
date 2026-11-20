package com.showcase.steps.api;

import static com.showcase.steps.ScenarioContext.need;
import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.microsoft.playwright.APIResponse;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.InvoiceDetail;
import com.showcase.api.KnownDefect;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Products;
import com.showcase.steps.PlaywrightContext;
import com.showcase.steps.ScenarioContext;
import io.cucumber.datatable.DataTable;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.Map;
import java.util.function.Function;
import org.junit.jupiter.api.function.Executable;

/**
 * Steps layer for features/api/invoices.feature (A6) and permissions.feature (A10, A11: known
 * defects, ADR 0010). TypeScript twin: src/steps/api/invoices.steps.ts.
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
  private InvoiceDetail order;

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

  // --- A10, A11: known defects ---

  @When("that customer tries to publish a product through the API")
  public void thatCustomerTriesToPublishAProduct() {
    // Intended: 403. Today: 201, because StoreProduct::authorize() returns true and only DELETE
    // requires the admin role.
    ctx.response = api().createProductRequest(customerToken(), Products.newProductData(api()));
  }

  @Given("an order of someone else, in a status the API accepts")
  public void anOrderOfSomeoneElse() {
    String adminToken = playwright.adminToken();
    order =
        api().invoices(adminToken).data().stream()
            .map(i -> api().invoice(adminToken, i.id()))
            .filter(i -> ApiClient.INVOICE_STATUSES.contains(i.status()))
            .findFirst()
            .orElseThrow(
                () -> new AssertionError("a seeded invoice with a status the API accepts"));
  }

  @When("that customer sets that order to the status it already has")
  public void thatCustomerSetsThatOrderToItsStatus() {
    // Intended: 403. Today: 200, because the route only requires a signed-in user and checks
    // neither role nor owner.
    ctx.response = api().updateInvoiceStatusRequest(customerToken(), order.id(), order.status());
  }

  // The step where a known defect shows (ADR 0010): the scenario carries @known-defect, and the
  // scenario log marks this step as failing on purpose (ScenarioLog, KnownDefect).
  @Then(
      "the API should answer {int} for {string}, but answers {int} because of known defect {string}")
  public void theApiShouldAnswerButKnownDefect(
      int intended, String label, int today, String summary) {
    new KnownDefect(summary, intended, today)
        .check(need(ctx.response, "a When step that sends the request"), label);
  }

  @Then("the order is unchanged")
  public void theOrderIsUnchanged() {
    assertEquals(
        order.status(),
        api().invoice(playwright.adminToken(), order.id()).status(),
        "the order is unchanged");
  }

  private static void assertUnauthorized(APIResponse res, String label) {
    JsonObject body = JsonParser.parseString(res.text()).getAsJsonObject();
    assertEquals("Unauthorized", body.get("message").getAsString(), label + ": body");
  }
}
