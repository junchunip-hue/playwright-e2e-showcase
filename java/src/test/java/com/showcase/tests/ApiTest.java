package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.junit.UsePlaywright;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Paginated;
import com.showcase.api.ApiClient.Product;
import com.showcase.config.Env;
import com.showcase.config.ToolshopOptions;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

/** Mirrors tests/api/products.api.spec.ts. No browser is launched: only the Playwright request API. */
@UsePlaywright(ToolshopOptions.class)
@DisplayName("Toolshop API")
class ApiTest {

  @Test
  @Tag("smoke")
  @DisplayName("GET /products returns a paginated, well-formed list")
  void productsArePaginated(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Paginated<Product> res = api.getProducts(1);

      assertEquals(1, res.currentPage());
      assertFalse(res.data().isEmpty(), "no products returned");
      for (Product product : res.data()) {
        assertNotNull(product.id(), "id");
        assertNotNull(product.name(), "name");
        assertTrue(product.price() > 0, () -> "price of " + product.name());
      }
    }
  }

  @Test
  @Tag("smoke")
  @DisplayName("valid credentials return an access token")
  void validLoginReturnsToken(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      String token = api.login(Env.CUSTOMER_EMAIL, Env.CUSTOMER_PASSWORD);
      assertFalse(token.isBlank());
    }
  }

  @Test
  @Tag("negative")
  @DisplayName("wrong password is rejected with 401")
  void wrongPasswordIs401(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      assertEquals(401, api.loginRequest(Env.CUSTOMER_EMAIL, "definitely-wrong-password").status());
    }
  }
}
