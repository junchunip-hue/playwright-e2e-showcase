package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.JsonObject;
import com.microsoft.playwright.Playwright;
import com.showcase.annotations.Admin;
import com.showcase.annotations.SmokeTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.CreatedProduct;
import com.showcase.api.ApiClient.Product;
import com.showcase.config.Env;
import com.showcase.data.Products;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;

/** Mirrors tests/api/admin.api.spec.ts (A8). Creates data, so it runs against our own Toolshop only (@Admin). */
@ToolshopTest
@DisplayName("Admin API")
class AdminApiTest {

  @SmokeTest
  @Admin
  @DisplayName("A8: a product the admin publishes is listed, searchable and in stock")
  void publishedProductIsListed(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      String adminToken = api.login(Env.ADMIN_EMAIL, Env.ADMIN_PASSWORD);
      Map<String, Object> data = Products.newProductData(api);

      CreatedProduct created = api.createProduct(adminToken, data);

      // GET /products/{id} is checked against the Product contract: brand, category and image come back as objects.
      JsonObject product = api.getProductJson(created.id());
      assertEquals(data.get("name"), product.get("name").getAsString());
      assertEquals((double) data.get("price"), product.get("price").getAsDouble(), 0.001);
      assertTrue(product.get("in_stock").getAsBoolean(), "in_stock");
      assertEquals(data.get("brand_id"), product.getAsJsonObject("brand").get("id").getAsString());
      assertEquals(data.get("category_id"), product.getAsJsonObject("category").get("id").getAsString());

      List<String> found = api.searchProducts((String) data.get("name")).data().stream().map(Product::id).toList();
      assertEquals(List.of(created.id()), found);
    }
  }
}
