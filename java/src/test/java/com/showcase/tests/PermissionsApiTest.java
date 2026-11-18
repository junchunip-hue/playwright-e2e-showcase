package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Admin;
import com.showcase.annotations.Negative;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.InvoiceDetail;
import com.showcase.api.KnownDefect;
import com.showcase.config.Env;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Products;
import org.junit.jupiter.api.DisplayName;

/**
 * Mirrors tests/api/permissions.api.spec.ts (A10, A11): admin actions must be refused to customers. The pinned
 * Toolshop does not refuse them, so each test tracks the defect with {@link KnownDefect}: green while the API behaves
 * exactly as today, red once it is fixed or behaves any other way. A8 and S3 send the same requests as the admin.
 */
@ToolshopTest
@DisplayName("Permissions API")
class PermissionsApiTest {

  @SmokeTest
  @Negative
  @Admin
  @DisplayName("A10: a customer cannot publish a product")
  void customerCannotPublishProduct(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Customer customer = Customers.create(api);
      String token = api.login(customer.email(), customer.password());

      APIResponse res = api.createProductRequest(token, Products.newProductData(api));

      // Intended: 403. Today: 201, because StoreProduct::authorize() returns true and only DELETE requires the admin role.
      new KnownDefect("POST /products checks no role", 403, 201).check(res, "POST /products as a customer");
    }
  }

  @SmokeTest
  @Negative
  @Admin
  @DisplayName("A11: a customer cannot change the status of an order")
  void customerCannotChangeOrderStatus(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      String adminToken = api.login(Env.ADMIN_EMAIL, Env.ADMIN_PASSWORD);
      // Someone else's order: a seeded invoice in a status the API accepts, as the admin sees it.
      InvoiceDetail order = api.invoices(adminToken).data().stream()
          .map(i -> api.invoice(adminToken, i.id()))
          .filter(i -> ApiClient.INVOICE_STATUSES.contains(i.status()))
          .findFirst()
          .orElseThrow(() -> new AssertionError("a seeded invoice with a status the API accepts"));

      Customer customer = Customers.create(api);
      String token = api.login(customer.email(), customer.password());
      // Sends the status the order already has, so the request changes nothing even while the defect exists.
      APIResponse res = api.updateInvoiceStatusRequest(token, order.id(), order.status());

      // Intended: 403. Today: 200, because the route only requires a signed-in user and checks neither role nor owner.
      new KnownDefect("PUT /invoices/{id}/status checks neither role nor ownership", 403, 200)
          .check(res, "PUT /invoices/{id}/status as another customer");
      assertEquals(order.status(), api.invoice(adminToken, order.id()).status(), "the order is unchanged");
    }
  }
}
