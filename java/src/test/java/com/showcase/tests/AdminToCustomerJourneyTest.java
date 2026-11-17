package com.showcase.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Admin;
import com.showcase.annotations.Journey;
import com.showcase.annotations.RegressionTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.CreatedProduct;
import com.showcase.api.ApiClient.InvoiceDetail;
import com.showcase.api.ApiClient.Product;
import com.showcase.config.Env;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Payments;
import com.showcase.data.Products;
import com.showcase.flows.CheckoutFlow;
import com.showcase.pages.AccountInvoicesPage;
import com.showcase.pages.HomePage;
import java.util.List;
import org.junit.jupiter.api.DisplayName;

/**
 * Mirrors tests/e2e/admin-to-customer.spec.ts (S3), step for step: the admin works through the API, the customer
 * through the UI and their own token. Creates catalogue data, so it runs against our own Toolshop only (@Admin).
 */
@ToolshopTest
@DisplayName("Admin to customer")
class AdminToCustomerJourneyTest {

  @RegressionTest
  @Journey
  @Admin
  @DisplayName("S3: admin publishes a product, a customer buys it, the admin ships it")
  void publishBuyShip(Page page, Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      // 1. Admin (API): publish a new product.
      String adminToken = api.login(Env.ADMIN_EMAIL, Env.ADMIN_PASSWORD);
      CreatedProduct published = api.createProduct(adminToken, Products.newProductData(api));
      Customer customer = Customers.create(api);

      // 2. Customer (UI): find it by name, buy it.
      HomePage homePage = new HomePage(page);
      homePage.navigate();
      homePage.search(published.name());
      assertThat(homePage.productNames).hasText(new String[] {published.name()});

      Product product = api.getProduct(published.id());
      CheckoutFlow checkout = new CheckoutFlow(page);
      checkout.addToCart(product);
      double cartTotal = checkout.reviewCart(List.of(product));
      checkout.signIn(customer);
      checkout.confirmAddress(customer.address());
      String invoiceNumber = checkout.pay(Payments.cashOnDelivery());

      // 3. Admin (API): ship the order.
      String message = "Shipped by the S3 journey";
      InvoiceDetail found = api.findInvoiceByNumber(adminToken, invoiceNumber);
      assertEquals(cartTotal, found.total(), 0.01);
      api.updateInvoiceStatus(adminToken, found.id(), "SHIPPED", message);

      // 4. Customer: the order is listed in their account, and their own API view shows the new status.
      AccountInvoicesPage invoices = new AccountInvoicesPage(page);
      invoices.navigate();
      assertThat(invoices.row(invoiceNumber)).isVisible();

      InvoiceDetail mine = api.invoice(api.login(customer.email(), customer.password()), found.id());
      assertEquals(invoiceNumber, mine.invoiceNumber());
      assertEquals("SHIPPED", mine.status());
      assertEquals(message, mine.statusMessage());
    }
  }
}
