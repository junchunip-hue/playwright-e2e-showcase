package com.showcase.api;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.annotations.SerializedName;
import com.google.gson.reflect.TypeToken;
import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.options.RequestOptions;
import com.showcase.config.Env;
import java.util.List;
import java.util.Map;

/**
 * Java twin of src/api/ApiClient.ts (only the endpoints the Java scenarios need).
 * Used for API tests and for fast test-data setup in UI tests.
 */
public final class ApiClient implements AutoCloseable {
  private static final Gson GSON = new Gson();

  public record Product(
      String id,
      String name,
      double price,
      @SerializedName("in_stock") boolean inStock,
      @SerializedName("is_rental") boolean isRental) {}

  public record Paginated<T>(@SerializedName("current_page") int currentPage, List<T> data, int total) {}

  private final APIRequestContext request;

  private ApiClient(APIRequestContext request) {
    this.request = request;
  }

  public static ApiClient create(Playwright playwright) {
    return new ApiClient(playwright.request().newContext(new APIRequest.NewContextOptions().setBaseURL(Env.API_URL)));
  }

  public APIResponse loginRequest(String email, String password) {
    return request.post("/users/login", RequestOptions.create().setData(Map.of("email", email, "password", password)));
  }

  public String login(String email, String password) {
    APIResponse res = loginRequest(email, password);
    ensureOk(res, "POST /users/login");
    return GSON.fromJson(res.text(), JsonObject.class).get("access_token").getAsString();
  }

  public Paginated<Product> getProducts(int page) {
    return getProductPage("/products", RequestOptions.create().setQueryParam("page", page));
  }

  public Paginated<Product> searchProducts(String query) {
    return getProductPage("/products/search", RequestOptions.create().setQueryParam("q", query));
  }

  /**
   * Returns a purchasable product. Stock changes over time, so UI tests ask the API
   * for an in-stock item instead of hard-coding a product name.
   */
  public Product findInStockProduct() {
    return getProducts(1).data().stream()
        .filter(p -> p.inStock() && !p.isRental())
        .findFirst()
        .orElseThrow(() -> new IllegalStateException("No in-stock product found on page 1 of /products"));
  }

  private Paginated<Product> getProductPage(String path, RequestOptions options) {
    APIResponse res = request.get(path, options);
    ensureOk(res, "GET " + path);
    return GSON.fromJson(res.text(), TypeToken.getParameterized(Paginated.class, Product.class).getType());
  }

  private static void ensureOk(APIResponse res, String label) {
    if (res.ok()) return;
    // Include the start of the body: server errors are otherwise invisible in CI.
    String body = res.text();
    throw new IllegalStateException(label + " failed: " + res.status() + "\n" + body.substring(0, Math.min(500, body.length())));
  }

  @Override
  public void close() {
    request.dispose();
  }
}
