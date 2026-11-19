package com.showcase.tests;

import static com.microsoft.playwright.assertions.PlaywrightAssertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Journey;
import com.showcase.annotations.Negative;
import com.showcase.annotations.RegressionCases;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Invoice;
import com.showcase.api.ApiClient.Product;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Payments;
import com.showcase.data.Payments.InvalidCard;
import com.showcase.data.Payments.Payment;
import com.showcase.flows.CheckoutFlow;
import com.showcase.pages.CheckoutPage;
import java.util.List;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.params.provider.MethodSource;

/** Mirrors tests/e2e/payments.spec.ts (S2): the checkout journey over every other payment method, plus invalid cards. */
@ToolshopTest
@DisplayName("Payment methods")
class PaymentJourneyTest {

  static Stream<Named<Payment>> methods() {
    return Payments.journeyMethods().stream().map(p -> Named.of(p.method(), p));
  }

  static Stream<Named<InvalidCard>> invalidCards() {
    return Payments.invalidCards().stream().map(c -> Named.of(c.name(), c));
  }

  @RegressionCases
  @Journey
  @MethodSource("methods")
  @DisplayName("S2: new customer pays with each payment method")
  void paysWith(Payment payment, Page page, Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Customer customer = Customers.create(api);
      Product product = api.findInStockProduct();

      CheckoutFlow checkout = new CheckoutFlow(page);
      checkout.addToCart(product);
      double cartTotal = checkout.reviewCart(List.of(product));
      checkout.signIn(customer);
      checkout.confirmSavedAddress(customer.address());
      String invoiceNumber = checkout.pay(payment);

      Invoice invoice = Invoices.find(api, customer, invoiceNumber);
      assertEquals(cartTotal, invoice.total(), 0.01);
    }
  }

  @RegressionCases
  @Journey
  @Negative
  @MethodSource("invalidCards")
  @DisplayName("S2: invalid card is blocked before payment and creates no invoice")
  void invalidCardIsBlocked(InvalidCard card, Page page, Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Customer customer = Customers.create(api);
      Product product = api.findInStockProduct();

      CheckoutFlow checkout = new CheckoutFlow(page);
      checkout.addToCart(product);
      checkout.reviewCart(List.of(product));
      checkout.signIn(customer);
      checkout.confirmSavedAddress(customer.address());
      checkout.enterPayment(card.payment());

      // The form flags the field and cannot be submitted.
      CheckoutPage form = checkout.page();
      assertThat(form.paymentField(card.field())).hasClass(Pattern.compile("ng-invalid"));
      assertThat(form.paymentFieldErrors.first()).isVisible();
      assertThat(form.finish).isDisabled();

      // The API would reject it too, and nothing was ordered.
      assertEquals(422, api.paymentCheckRequest(card.payment()).status());
      assertEquals(List.of("payment_details." + card.field()), api.paymentRejectedFields(api.paymentCheckRequest(card.payment())));
      assertEquals(0, Invoices.of(api, customer).total());
    }
  }
}
