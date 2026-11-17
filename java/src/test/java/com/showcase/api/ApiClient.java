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
import com.showcase.data.Payments;
import java.util.List;
import java.util.Map;
import java.util.function.Function;

/**
 * Java twin of src/api/ApiClient.ts. Every JSON response is checked against its contract in {@link Contracts}
 * (the twin of src/api/schemas.ts) before it is read, so any test that touches the API also checks the contract.
 */
public final class ApiClient implements AutoCloseable {
  private static final Gson GSON = new Gson();

  public record Product(
      String id,
      String name,
      double price,
      @SerializedName("in_stock") boolean inStock,
      @SerializedName("is_rental") boolean isRental) {}

  public record Paginated<T>(
      @SerializedName("current_page") int currentPage,
      List<T> data,
      Integer from,
      int total,
      @SerializedName("per_page") int perPage) {}

  public record Invoice(
      String id,
      @SerializedName("invoice_number") String invoiceNumber,
      double total,
      @SerializedName("billing_country") String billingCountry) {}

  private final APIRequestContext request;

  private ApiClient(APIRequestContext request) {
    this.request = request;
  }

  public static ApiClient create(Playwright playwright) {
    return new ApiClient(playwright.request().newContext(new APIRequest.NewContextOptions().setBaseURL(Env.API_URL)));
  }

  // --- auth (TS: api.auth) ---

  public APIResponse loginRequest(String email, String password) {
    return request.post("/users/login", json(Map.of("email", email, "password", password)));
  }

  public String login(String email, String password) {
    JsonObject body = parse(loginRequest(email, password), "POST /users/login", Contracts::login);
    return body.get("access_token").getAsString();
  }

  // --- customers and addresses (TS: api.customers, api.addresses) ---

  /** POST /users/register, raw response for tests that expect a rejection; payload from {@link com.showcase.data.Customers}. */
  public APIResponse registerRequest(Map<String, Object> customer) {
    return request.post("/users/register", json(customer));
  }

  public void registerCustomer(Map<String, Object> customer) {
    ensureOk(registerRequest(customer), "POST /users/register");
  }

  /** Field → messages of a rejected request (422/409), checked against Contracts.validationErrors. */
  public Map<String, List<String>> validationErrors(APIResponse res, String label) {
    JsonObject body = GSON.fromJson(res.text(), JsonObject.class);
    Contracts.require(label + " error body", Contracts.validationErrors(body));
    return GSON.fromJson(body, new TypeToken<Map<String, List<String>>>() {}.getType());
  }

  /**
   * The postcode lookup the checkout form uses (Toolshop validates that city/state match the postcode),
   * returned with the field names the register API expects.
   */
  public Map<String, String> lookupAddress(String country, String postcode, String houseNumber) {
    JsonObject body = parse(request.get("/postcode-lookup", RequestOptions.create()
        .setQueryParam("country", country)
        .setQueryParam("postcode", postcode)
        .setQueryParam("house_number", houseNumber)), "GET /postcode-lookup", Contracts::postcodeLookup);
    return Map.of(
        "street", body.get("street").getAsString(),
        "house_number", body.get("house_number").getAsString(),
        "city", body.get("city").getAsString(),
        "state", body.get("state").getAsString(),
        "country", body.get("country").getAsString(),
        "postal_code", body.get("postcode").getAsString());
  }

  // --- products (TS: api.products) ---

  public Paginated<Product> getProducts(int page) {
    JsonObject body = parse(request.get("/products", RequestOptions.create().setQueryParam("page", page)),
        "GET /products", b -> Contracts.paginator(b, Contracts.productItem(true)));
    return GSON.fromJson(body, TypeToken.getParameterized(Paginated.class, Product.class).getType());
  }

  public Product getProduct(String id) {
    return GSON.fromJson(getProductJson(id), Product.class);
  }

  /** The contract-checked body of GET /products/{id}, for tests that inspect or tamper with raw fields. */
  public JsonObject getProductJson(String id) {
    return parse(request.get("/products/" + id), "GET /products/{id}", b -> Contracts.product(b, true));
  }

  /** Search results use the search contract: same as Product but without category.slug (a known API quirk). */
  public Paginated<Product> searchProducts(String query) {
    JsonObject body = parse(request.get("/products/search", RequestOptions.create().setQueryParam("q", query)),
        "GET /products/search", b -> Contracts.paginator(b, Contracts.productItem(false)));
    return GSON.fromJson(body, TypeToken.getParameterized(Paginated.class, Product.class).getType());
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

  // --- invoices and payments (TS: api.invoices, api.payments) ---

  /** GET /invoices: the signed-in customer's own invoices. */
  public Paginated<Invoice> invoices(String token) {
    JsonObject body = parse(request.get("/invoices", RequestOptions.create().setHeader("Authorization", "Bearer " + token)),
        "GET /invoices", b -> Contracts.paginator(b, Contracts.invoiceItem()));
    return GSON.fromJson(body, TypeToken.getParameterized(Paginated.class, Invoice.class).getType());
  }

  /** POST /payment/check, raw response. No login needed. */
  public APIResponse paymentCheckRequest(Payments.Payment payment) {
    return request.post("/payment/check", json(Map.of("payment_method", payment.method(), "payment_details", payment.details())));
  }

  /** Succeeds only for "Payment was successful". */
  public void checkPayment(Payments.Payment payment) {
    APIResponse res = paymentCheckRequest(payment);
    ensureOk(res, "POST /payment/check");
    String message = GSON.fromJson(res.text(), JsonObject.class).get("message").getAsString();
    if (!"Payment was successful".equals(message)) {
      throw new IllegalStateException("POST /payment/check: unexpected message " + message);
    }
  }

  /** Field names of a rejected payment check, e.g. payment_details.credit_card_number (Laravel's 422 body). */
  public List<String> paymentRejectedFields(APIResponse res) {
    JsonObject errors = GSON.fromJson(res.text(), JsonObject.class).getAsJsonObject("errors");
    Contracts.require("POST /payment/check error body", Contracts.validationErrors(errors));
    return errors.keySet().stream().sorted().toList();
  }

  // --- plumbing (TS: src/api/http.ts) ---

  private static RequestOptions json(Object data) {
    return RequestOptions.create().setHeader("Accept", "application/json").setData(data);
  }

  /** Status first, then the contract; returns the parsed body. */
  private static JsonObject parse(APIResponse res, String label, Function<JsonObject, List<String>> contract) {
    ensureOk(res, label);
    JsonObject body = GSON.fromJson(res.text(), JsonObject.class);
    Contracts.require(label, contract.apply(body));
    return body;
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
