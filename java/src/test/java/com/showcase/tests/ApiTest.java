package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Negative;
import com.showcase.annotations.RegressionTest;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Paginated;
import com.showcase.api.ApiClient.Product;
import com.showcase.config.Env;
import org.junit.jupiter.api.DisplayName;

/** Mirrors tests/api/products.api.spec.ts. No browser is launched: only the Playwright request API. */
@ToolshopTest
@DisplayName("Toolshop API")
class ApiTest {

  @SmokeTest
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

  @SmokeTest
  @DisplayName("valid credentials return an access token")
  void validLoginReturnsToken(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      String token = api.login(Env.CUSTOMER_EMAIL, Env.CUSTOMER_PASSWORD);
      assertFalse(token.isBlank());
    }
  }

  @RegressionTest
  @Negative
  @DisplayName("wrong password is rejected with 401")
  void wrongPasswordIs401(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      assertEquals(401, api.loginRequest(Env.CUSTOMER_EMAIL, "definitely-wrong-password").status());
    }
  }
}
