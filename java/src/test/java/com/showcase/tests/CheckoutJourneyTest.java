package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Journey;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Invoice;
import com.showcase.api.ApiClient.Product;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Payments;
import com.showcase.flows.CheckoutFlow;
import java.util.List;
import org.junit.jupiter.api.DisplayName;

/**
 * Mirrors tests/e2e/checkout.spec.ts (U6 = journey S1), step for step:
 * arrange via API, act via UI (flows.CheckoutFlow), assert via API.
 */
@ToolshopTest
@DisplayName("Checkout")
class CheckoutJourneyTest {

  @SmokeTest
  @Journey
  @DisplayName("U6: new customer buys an in-stock product with cash on delivery")
  void firstPurchase(Page page, Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      // Arrange (API): a fresh account and a product that can actually be bought.
      Customer customer = Customers.create(api);
      Product product = api.findInStockProduct();

      // Act (UI): the real user journey.
      CheckoutFlow checkout = new CheckoutFlow(page);
      checkout.addToCart(product);
      double cartTotal = checkout.reviewCart(List.of(product)); // discounts applied: the expected invoice amount
      checkout.signIn(customer);
      checkout.confirmSavedAddress(customer.address());
      String invoiceNumber = checkout.pay(Payments.cashOnDelivery());

      // Assert (API): the order really exists in the backend, for this customer, at the right price.
      Invoice invoice = Invoices.find(api, customer, invoiceNumber);
      assertEquals(customer.address().get("country"), invoice.billingCountry());
      assertEquals(cartTotal, invoice.total(), 0.01);
    }
  }
}
