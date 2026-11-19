package com.showcase.steps;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static com.showcase.steps.ScenarioContext.need;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.CreatedProduct;
import com.showcase.api.ApiClient.Invoice;
import com.showcase.api.ApiClient.InvoiceDetail;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Products;
import com.showcase.pages.AccountInvoicesPage;
import com.showcase.pages.HomePage;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.Map;

/**
 * Steps layer for the admin side of features/journeys/admin-to-customer.feature (S3) and guest-checkout.feature (S4).
 * The admin works through the API; @admin scenarios are skipped on the public demo (Hooks).
 * TypeScript twin: src/steps/admin.steps.ts.
 */
public class AdminSteps {
  private static final String PAID = "When I pay with \"...\"";
  private static final String FOUND = "Then the admin finds the order at the cart total";
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;

  public AdminSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  @Given("the admin has published a new product")
  public void theAdminHasPublishedANewProduct() {
    ApiClient api = playwright.api();
    CreatedProduct published = api.createProduct(playwright.adminToken(), Products.newProductData(api));
    ctx.product = api.getProduct(published.id());
  }

  @When("I search the catalogue for that product")
  public void iSearchTheCatalogueForThatProduct() {
    HomePage homePage = new HomePage(playwright.page());
    homePage.open();
    homePage.search(ctx.product().name());
  }

  @Then("the search shows only that product")
  public void theSearchShowsOnlyThatProduct() {
    assertThat(new HomePage(playwright.page()).ui.productNames).hasText(new String[] {ctx.product().name()});
  }

  @Then("the admin finds the order at the cart total")
  public void theAdminFindsTheOrderAtTheCartTotal() {
    InvoiceDetail invoice = playwright.api().findInvoiceByNumber(playwright.adminToken(), need(ctx.invoiceNumber, PAID));
    assertEquals(need(ctx.cartTotal, "When I review the cart"), invoice.total(), 0.01);
    ctx.invoiceId = invoice.id();
  }

  @When("the admin marks the order as shipped")
  public void theAdminMarksTheOrderAsShipped() {
    ctx.shippedMessage = "Shipped by the S3 journey";
    playwright.api().updateInvoiceStatus(playwright.adminToken(), need(ctx.invoiceId, FOUND), "SHIPPED", ctx.shippedMessage);
  }

  @Then("my invoices list shows the order")
  public void myInvoicesListShowsTheOrder() {
    AccountInvoicesPage invoices = new AccountInvoicesPage(playwright.page());
    invoices.navigate();
    assertThat(invoices.row(need(ctx.invoiceNumber, PAID))).isVisible();
  }

  @Then("my own view of the order says it was shipped")
  public void myOwnViewOfTheOrderSaysItWasShipped() {
    Customer customer = ctx.customer();
    ApiClient api = playwright.api();
    InvoiceDetail mine = api.invoice(api.login(customer.email(), customer.password()), need(ctx.invoiceId, FOUND));
    assertEquals(ctx.invoiceNumber, mine.invoiceNumber());
    assertEquals("SHIPPED", mine.status());
    assertEquals(ctx.shippedMessage, mine.statusMessage());
  }

  @Then("the order is billed to the guest's address")
  public void theOrderIsBilledToTheGuestsAddress() {
    String invoiceNumber = need(ctx.invoiceNumber, PAID);
    Map<String, String> address = ctx.guestAddress();
    Invoice invoice = playwright.api().searchInvoices(playwright.adminToken(), invoiceNumber).data().stream()
        .filter(i -> i.invoiceNumber().equals(invoiceNumber))
        .findFirst()
        .orElseThrow(() -> new AssertionError("guest invoice " + invoiceNumber + " not found"));
    assertEquals(address.get("street"), invoice.billingStreet());
    assertEquals(address.get("city"), invoice.billingCity());
    assertEquals(address.get("country"), invoice.billingCountry());
  }
}
