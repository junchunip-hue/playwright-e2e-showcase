package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Admin;
import com.showcase.annotations.Journey;
import com.showcase.annotations.RegressionTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Invoice;
import com.showcase.api.ApiClient.Product;
import com.showcase.config.Env;
import com.showcase.data.Customers;
import com.showcase.data.Payments;
import com.showcase.flows.CheckoutFlow;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;

/**
 * Mirrors tests/e2e/guest-checkout.spec.ts (S4): the second way into checkout. A guest never registers, the postcode
 * lookup fills the address, and the order goes to POST /invoices/guest. A guest invoice belongs to no user, so only
 * the admin can look it up afterwards: own Toolshop only (@Admin).
 */
@ToolshopTest
@DisplayName("Guest checkout")
class GuestCheckoutJourneyTest {

  @RegressionTest
  @Journey
  @Admin
  @DisplayName("S4: a guest buys without an account and the order exists at the cart total")
  @SuppressWarnings("unchecked")
  void guestBuys(Page page, Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      // Arrange (API): guest details (never registered) and a product that can actually be bought.
      Map<String, Object> guest = Customers.data(api, Map.of());
      Map<String, String> address = (Map<String, String>) guest.get("address");
      Product product = api.findInStockProduct();

      // Act (UI): same flow as U6, but "continue as guest" instead of signing in.
      CheckoutFlow checkout = new CheckoutFlow(page);
      checkout.addToCart(product);
      double cartTotal = checkout.reviewCart(List.of(product));
      checkout.continueAsGuest((String) guest.get("email"), (String) guest.get("first_name"), (String) guest.get("last_name"));
      checkout.confirmAddress(address);
      String invoiceNumber = checkout.pay(Payments.cashOnDelivery());

      // Assert (API, as admin): the order exists, at the cart total, with the guest's billing address.
      String adminToken = api.login(Env.ADMIN_EMAIL, Env.ADMIN_PASSWORD);
      Invoice invoice = api.searchInvoices(adminToken, invoiceNumber).data().stream()
          .filter(i -> i.invoiceNumber().equals(invoiceNumber))
          .findFirst()
          .orElseThrow(() -> new AssertionError("guest invoice " + invoiceNumber + " not found"));
      assertEquals(cartTotal, invoice.total(), 0.01);
      assertEquals(address.get("street"), invoice.billingStreet());
      assertEquals(address.get("city"), invoice.billingCity());
      assertEquals(address.get("country"), invoice.billingCountry());
    }
  }
}
