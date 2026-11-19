package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Journey;
import com.showcase.annotations.RegressionTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Favorite;
import com.showcase.api.ApiClient.Product;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Payments;
import com.showcase.flows.CheckoutFlow;
import com.showcase.flows.ShopperFlow;
import com.showcase.flows.ShopperFlow.PdfFile;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.condition.DisabledIf;

/**
 * Mirrors tests/e2e/returning-customer.spec.ts (S5): a customer who signs in first and shops around before buying:
 * favourites, a side-by-side comparison, then the order and its invoice as a PDF download. The PDF is written by a
 * background job, which CI runs (.github/actions/toolshop-ready); the public demo did not finish it in minutes.
 */
@ToolshopTest
@DisplayName("Returning customer")
class ReturningCustomerJourneyTest {

  @RegressionTest
  @Journey
  @DisabledIf(value = "com.showcase.config.Env#isPublicDemo", disabledReason = "the public demo does not finish invoice PDFs in time")
  @DisplayName("S5: a returning customer saves a favourite, compares two products, buys the cheaper one and downloads the invoice")
  void returningCustomer(Page page, Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      // Arrange (API): a registered customer and two different products that can be bought.
      Customer customer = Customers.create(api);
      List<Product> products = api.findInStockProducts(2);
      Product first = products.get(0);
      Product second = products.get(1);

      // Act (UI): sign in, keep one product as a favourite, compare both.
      ShopperFlow shopper = new ShopperFlow(page);
      shopper.signIn(customer);
      shopper.addToFavorites(first);
      assertEquals(List.of(first.name()), shopper.favorites());

      Map<String, Double> shown = shopper.compare(products);
      assertEquals(Map.of(first.name(), first.price(), second.name(), second.price()), shown, "the comparison shows the catalogue prices");

      // Buy the cheaper of the two, already signed in.
      Product cheaper = products.stream().min(Comparator.comparingDouble(Product::price)).orElseThrow();
      CheckoutFlow checkout = new CheckoutFlow(page);
      checkout.addToCart(cheaper);
      double cartTotal = checkout.reviewCart(List.of(cheaper));
      checkout.continueSignedIn();
      checkout.confirmAddress(customer.address());
      String invoiceNumber = checkout.pay(Payments.cashOnDelivery());

      // The invoice as a file: named after the order, and a real PDF.
      PdfFile pdf = shopper.downloadInvoice(invoiceNumber);
      assertEquals(invoiceNumber + ".pdf", pdf.fileName());
      assertEquals("%PDF-", new String(Arrays.copyOf(pdf.body(), 5), StandardCharsets.US_ASCII));

      // Assert (API, as the customer): the favourite and the order are stored, the PDF is marked complete.
      String token = api.login(customer.email(), customer.password());
      assertEquals(List.of(first.id()), api.favorites(token).stream().map(Favorite::productId).toList());
      assertEquals(cartTotal, Invoices.find(api, customer, invoiceNumber).total(), 0.01);
      assertEquals("COMPLETED", api.pdfStatus(token, invoiceNumber));
    }
  }
}
