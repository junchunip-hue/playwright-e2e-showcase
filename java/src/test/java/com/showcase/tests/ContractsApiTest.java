package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.JsonObject;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Paginated;
import com.showcase.api.ApiClient.Product;
import com.showcase.api.Contracts;
import com.showcase.data.Customers;
import com.showcase.data.Customers.Customer;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;

/**
 * Mirrors tests/api/contracts.api.spec.ts (A0). ApiClient checks every response against {@link Contracts} (the twin
 * of src/api/schemas.ts), so each call below is a contract check; the assertions cover what a contract cannot.
 */
@ToolshopTest
@DisplayName("API contracts")
class ContractsApiTest {

  @SmokeTest
  @DisplayName("A0: product list, product detail and search agree on the Product contract")
  void listDetailAndSearchAgree(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Product listed = api.getProducts(1).data().get(0);

      Product detail = api.getProduct(listed.id());
      assertEquals(listed.id(), detail.id());
      assertEquals(listed.name(), detail.name());
      assertEquals(listed.price(), detail.price());

      // Search uses the search contract: same as Product minus category.slug (a known API inconsistency).
      List<String> found = api.searchProducts(listed.name()).data().stream().map(Product::id).toList();
      assertTrue(found.contains(listed.id()), "search for \"" + listed.name() + "\" should find " + listed.id());
    }
  }

  @SmokeTest
  @DisplayName("A0: an empty search still returns a valid paginator")
  void emptySearch(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Paginated<Product> res = api.searchProducts("no-such-product-zz9");
      assertEquals(0, res.total());
      assertEquals(List.of(), res.data());
      assertNull(res.from());
    }
  }

  @SmokeTest
  @DisplayName("A0: login and invoice list for a new customer")
  void loginAndInvoices(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Customer customer = Customers.create(api);
      String token = api.login(customer.email(), customer.password());

      assertEquals(0, api.invoices(token).total());
    }
  }

  @SmokeTest
  @DisplayName("A0: postcode lookup returns a usable address")
  void postcodeLookup(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Map<String, String> address = api.lookupAddress("US", "90210", "1");
      assertEquals("US", address.get("country"));
      assertEquals("90210", address.get("postal_code"));
    }
  }

  // The guard itself: proves a contract break is reported with the field path, not swallowed.
  @SmokeTest
  @DisplayName("A0: rejects a retyped field and names it")
  void guardNamesRetypedField(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      JsonObject valid = api.getProductJson(api.getProducts(1).data().get(0).id());
      JsonObject tampered = valid.deepCopy();
      tampered.addProperty("price", valid.get("price").getAsString());

      List<String> problems = Contracts.product(tampered, true);

      assertEquals(1, problems.size(), problems.toString());
      assertTrue(problems.get(0).startsWith("price: expected a number"), problems.get(0));
    }
  }
}
