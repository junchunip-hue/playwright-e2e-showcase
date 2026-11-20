package com.showcase.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static com.showcase.steps.ScenarioContext.need;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Invoice;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Payments;
import com.showcase.data.Payments.InvalidCard;
import com.showcase.pages.CheckoutPage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Steps layer for features/journeys/checkout.feature and guest-checkout.feature: the checkout
 * journey, one wizard step per sentence. The waits live in pages/CheckoutPage; the outcome is
 * asserted here, in the UI and the API. TypeScript twin: src/steps/checkout.steps.ts.
 */
public class CheckoutSteps {
  private static final String PAID = "When I pay with \"...\"";
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;
  private CheckoutPage checkoutPage;

  public CheckoutSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  /** Built on first use: the browser page exists only once the @Before hook has run. */
  private CheckoutPage checkoutPage() {
    if (checkoutPage == null) checkoutPage = new CheckoutPage(playwright.page());
    return checkoutPage;
  }

  @Given("guest details that were never registered")
  public void guestDetailsThatWereNeverRegistered() {
    ctx.guest = Customers.data(playwright.api(), Map.of());
  }

  @When("I review the cart")
  public void iReviewTheCart() {
    ctx.cartTotal = checkoutPage().reviewCart(List.of(ctx.product().name()));
  }

  @When("I sign in as that customer at the checkout's sign-in step")
  public void iSignInAsThatCustomerAtCheckout() {
    Customer customer = ctx.customer();
    checkoutPage().signIn(customer.email(), customer.password());
  }

  @When("I continue as that guest")
  public void iContinueAsThatGuest() {
    Map<String, Object> guest = need(ctx.guest, "Given guest details that were never registered");
    checkoutPage()
        .continueAsGuest(
            (String) guest.get("email"),
            (String) guest.get("first_name"),
            (String) guest.get("last_name"));
  }

  @When("I confirm my saved billing address")
  public void iConfirmMySavedBillingAddress() {
    checkoutPage().confirmAddress(ctx.customer().address());
  }

  @When("I enter the guest's billing address for the postcode lookup")
  public void iEnterTheGuestsBillingAddressForThePostcodeLookup() {
    checkoutPage().enterAddressForLookup(ctx.guestAddress());
  }

  @When("I pay with {string}")
  public void iPayWith(String method) {
    ctx.invoiceNumber = checkoutPage().pay(Payments.forMethod(method));
  }

  @When("I enter the payment details of a {string}")
  public void iEnterThePaymentDetailsOfA(String card) {
    ctx.invalidCard = Payments.invalidCardNamed(card);
    checkoutPage().enterPayment(ctx.invalidCard.payment());
  }

  @Then("that customer's invoice exists at the cart total")
  public void thatCustomersInvoiceExistsAtTheCartTotal() {
    Invoice invoice = customersInvoice();
    assertEquals(need(ctx.cartTotal, "When I review the cart"), invoice.total(), 0.01);
  }

  @Then("the invoice is billed to the customer's country")
  public void theInvoiceIsBilledToTheCustomersCountry() {
    assertEquals(ctx.customer().address().get("country"), customersInvoice().billingCountry());
  }

  @Then("the form flags that card's invalid field and cannot be submitted")
  public void theFormFlagsThatCardsInvalidField() {
    InvalidCard card = need(ctx.invalidCard, "When I enter the payment details of a \"...\"");
    assertThat(checkoutPage().ui.paymentField(card.field()))
        .hasClass(Pattern.compile("ng-invalid"));
    assertThat(checkoutPage().ui.paymentFieldErrors.first()).isVisible();
    assertThat(checkoutPage().ui.finish).isDisabled();
  }

  @Then("the payment API rejects those details for that field only")
  public void thePaymentApiRejectsThoseDetails() {
    InvalidCard card = need(ctx.invalidCard, "When I enter the payment details of a \"...\"");
    ApiClient api = playwright.api();
    assertEquals(422, api.paymentCheckRequest(card.payment()).status());
    assertEquals(
        List.of("payment_details." + card.field()),
        api.paymentRejectedFields(api.paymentCheckRequest(card.payment())));
  }

  @Then("that customer has no invoices")
  public void thatCustomerHasNoInvoices() {
    Customer customer = ctx.customer();
    ApiClient api = playwright.api();
    assertEquals(0, api.invoices(api.login(customer.email(), customer.password())).total());
  }

  /** The customer's invoice with the number shown at checkout, through the customer's own token. */
  private Invoice customersInvoice() {
    Customer customer = ctx.customer();
    String invoiceNumber = need(ctx.invoiceNumber, PAID);
    ApiClient api = playwright.api();
    return api.invoices(api.login(customer.email(), customer.password())).data().stream()
        .filter(i -> i.invoiceNumber().equals(invoiceNumber))
        .findFirst()
        .orElseThrow(() ->
            new AssertionError(
                "invoice " + invoiceNumber + " for " + customer.email() + " not found"));
  }
}
