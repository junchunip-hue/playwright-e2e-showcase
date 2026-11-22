package com.showcase.api;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
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
import java.util.function.Function;

/**
 * Java twin of src/api/ApiClient.ts. Every JSON response is checked against its contract in {@link
 * Contracts} (the twin of src/api/schemas.ts) before it is read, so any test that touches the API
 * also checks the contract.
 */
public final class ApiClient implements AutoCloseable {
  private static final Gson GSON = new Gson();

  public record Product(
      String id,
      String name,
      double price,
      @SerializedName("in_stock") boolean inStock,
      @SerializedName("is_rental") boolean isRental,
      Ref brand,
      Ref category) {}

  /**
   * Query of GET /products (TS: ProductFilter). Build it step by step: {@code
   * ProductFilter.page(1).byBrand(id).price(10, 20).sort("price", "asc")}.
   */
  public record ProductFilter(
      int page,
      String byCategory,
      String byBrand,
      Double min,
      Double max,
      String sortBy,
      String order) {
    public static ProductFilter page(int page) {
      return new ProductFilter(page, null, null, null, null, null, null);
    }

    public ProductFilter byCategory(String id) {
      return new ProductFilter(page, id, byBrand, min, max, sortBy, order);
    }

    public ProductFilter byBrand(String id) {
      return new ProductFilter(page, byCategory, id, min, max, sortBy, order);
    }

    /** Inclusive price range. */
    public ProductFilter price(double from, double to) {
      return new ProductFilter(page, byCategory, byBrand, from, to, sortBy, order);
    }

    /** {@code by} is "name" or "price", {@code direction} "asc" or "desc". */
    public ProductFilter sort(String by, String direction) {
      return new ProductFilter(page, byCategory, byBrand, min, max, by, direction);
    }

    RequestOptions query() {
      RequestOptions options = RequestOptions.create().setQueryParam("page", page);
      if (byCategory != null) options.setQueryParam("by_category", byCategory);
      if (byBrand != null) options.setQueryParam("by_brand", byBrand);
      if (min != null) options.setQueryParam("between", "price," + plain(min) + "," + plain(max));
      if (sortBy != null) options.setQueryParam("sort", sortBy + "," + order);
      return options;
    }

    private static String plain(double value) {
      return java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString();
    }
  }

  /** A favourite with its product (TS: Favorite). */
  public record Favorite(String id, @SerializedName("product_id") String productId, Ref product) {}

  /**
   * A payment in the API's own shape (POST /payment/check; TS: Payment): {@code details} maps the
   * data-test id / API field to its value. Test data (data/Payments) builds one for both the
   * checkout form and the API.
   */
  public record Payment(String method, Map<String, String> details) {}

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
      @SerializedName("billing_street") String billingStreet,
      @SerializedName("billing_city") String billingCity,
      @SerializedName("billing_country") String billingCountry) {}

  public record InvoiceDetail(
      String id,
      @SerializedName("invoice_number") String invoiceNumber,
      double total,
      String status,
      @SerializedName("status_message") String statusMessage) {}

  /** A brand, category or image reference; {@code parentId} is set for sub-categories only. */
  public record Ref(String id, String name, @SerializedName("parent_id") String parentId) {}

  public record CreatedProduct(String id, String name, double price) {}

  private final APIRequestContext request;

  private ApiClient(APIRequestContext request) {
    this.request = request;
  }

  public static ApiClient create(Playwright playwright) {
    return new ApiClient(
        playwright
            .request()
            .newContext(new APIRequest.NewContextOptions().setBaseURL(Env.API_URL)));
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

  /**
   * POST /users/register, raw response for tests that expect a rejection; payload from {@link
   * com.showcase.data.Customers}.
   */
  public APIResponse registerRequest(Map<String, Object> customer) {
    return request.post("/users/register", json(customer));
  }

  public void registerCustomer(Map<String, Object> customer) {
    ensureOk(registerRequest(customer), "POST /users/register");
  }

  /**
   * Field → messages of a rejected request (422/409), checked against Contracts.validationErrors.
   */
  public Map<String, List<String>> validationErrors(APIResponse res, String label) {
    JsonObject body = GSON.fromJson(res.text(), JsonObject.class);
    Contracts.require(label + " error body", Contracts.validationErrors(body));
    return GSON.fromJson(body, new TypeToken<Map<String, List<String>>>() {}.getType());
  }

  /**
   * The postcode lookup the checkout form uses (Toolshop validates that city/state match the
   * postcode), returned with the field names the register API expects.
   */
  public Map<String, String> lookupAddress(String country, String postcode, String houseNumber) {
    JsonObject body =
        parse(
            request.get(
                "/postcode-lookup",
                RequestOptions.create()
                    .setQueryParam("country", country)
                    .setQueryParam("postcode", postcode)
                    .setQueryParam("house_number", houseNumber)),
            "GET /postcode-lookup",
            Contracts::postcodeLookup);
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
    JsonObject body =
        parse(
            request.get("/products", RequestOptions.create().setQueryParam("page", page)),
            "GET /products",
            b -> Contracts.paginator(b, Contracts.productItem(true)));
    return GSON.fromJson(
        body, TypeToken.getParameterized(Paginated.class, Product.class).getType());
  }

  public Product getProduct(String id) {
    return GSON.fromJson(getProductJson(id), Product.class);
  }

  /**
   * The contract-checked body of GET /products/{id}, for tests that inspect or tamper with raw
   * fields.
   */
  public JsonObject getProductJson(String id) {
    return parse(
        request.get("/products/" + id), "GET /products/{id}", b -> Contracts.product(b, true));
  }

  /**
   * Search results use the search contract: same as Product but without category.slug (a known API
   * quirk).
   */
  public Paginated<Product> searchProducts(String query) {
    JsonObject body =
        parse(
            request.get("/products/search", RequestOptions.create().setQueryParam("q", query)),
            "GET /products/search",
            b -> Contracts.paginator(b, Contracts.productItem(false)));
    return GSON.fromJson(
        body, TypeToken.getParameterized(Paginated.class, Product.class).getType());
  }

  /** GET /products with filters and sorting (TS: api.products.filter). */
  public Paginated<Product> filterProducts(ProductFilter filter) {
    JsonObject body =
        parse(
            request.get("/products", filter.query()),
            "GET /products (filtered)",
            b -> Contracts.paginator(b, Contracts.productItem(true)));
    return GSON.fromJson(
        body, TypeToken.getParameterized(Paginated.class, Product.class).getType());
  }

  /**
   * Returns a purchasable product. Stock changes over time, so UI tests ask the API for an in-stock
   * item instead of hard-coding a product name.
   */
  public Product findInStockProduct() {
    return findInStockProducts(1).get(0);
  }

  /** {@code count} different purchasable products from page 1 (TS: findInStockProducts). */
  public List<Product> findInStockProducts(int count) {
    List<Product> products =
        getProducts(1).data().stream()
            .filter(p -> p.inStock() && !p.isRental())
            .limit(count)
            .toList();
    if (products.size() < count)
      throw new IllegalStateException(
          "Fewer than " + count + " in-stock products on page 1 of /products");
    return products;
  }

  // --- favourites (TS: api.favorites) ---

  public List<Favorite> favorites(String token) {
    APIResponse res = request.get("/favorites", auth(token));
    ensureOk(res, "GET /favorites");
    JsonArray items = GSON.fromJson(res.text(), JsonArray.class);
    Contracts.require("GET /favorites", Contracts.favorites(items));
    return GSON.fromJson(items, new TypeToken<List<Favorite>>() {}.getType());
  }

  // --- invoices and payments (TS: api.invoices, api.payments) ---

  /** GET /invoices: the signed-in customer's own invoices. */
  public Paginated<Invoice> invoices(String token) {
    JsonObject body =
        parse(
            request.get(
                "/invoices", RequestOptions.create().setHeader("Authorization", "Bearer " + token)),
            "GET /invoices",
            b -> Contracts.paginator(b, Contracts.invoiceItem()));
    return GSON.fromJson(
        body, TypeToken.getParameterized(Paginated.class, Invoice.class).getType());
  }

  public InvoiceDetail invoice(String token, String id) {
    JsonObject body =
        parse(
            request.get("/invoices/" + id, auth(token)),
            "GET /invoices/{id}",
            Contracts::invoiceDetail);
    return GSON.fromJson(body, InvoiceDetail.class);
  }

  /**
   * Search on invoice number, billing street and status (an admin sees every customer's invoices).
   */
  public Paginated<Invoice> searchInvoices(String token, String query) {
    JsonObject body =
        parse(
            request.get("/invoices/search", auth(token).setQueryParam("q", query)),
            "GET /invoices/search",
            b -> Contracts.paginator(b, Contracts.invoiceItem()));
    return GSON.fromJson(
        body, TypeToken.getParameterized(Paginated.class, Invoice.class).getType());
  }

  /** The invoice with this number as the token's user sees it (TS: api.invoices.findByNumber). */
  public InvoiceDetail findInvoiceByNumber(String token, String invoiceNumber) {
    Invoice match =
        searchInvoices(token, invoiceNumber).data().stream()
            .filter(i -> i.invoiceNumber().equals(invoiceNumber))
            .findFirst()
            .orElseThrow(
                () -> new IllegalStateException("invoice " + invoiceNumber + " not found"));
    return invoice(token, match.id());
  }

  /**
   * GET /invoices/{number}/download-pdf-status (TS: pdfStatus). 400 with NOT_INITIATED is an
   * answer, not an error: the background job has not picked the invoice up yet.
   */
  public String pdfStatus(String token, String invoiceNumber) {
    String label = "GET /invoices/" + invoiceNumber + "/download-pdf-status";
    APIResponse res = invoicePdfStatusRequest(invoiceNumber, token);
    if (res.status() != 400) ensureOk(res, label);
    JsonObject body = GSON.fromJson(res.text(), JsonObject.class);
    Contracts.require(label, Contracts.pdfStatus(body));
    return body.get("status").getAsString();
  }

  // Raw responses (any status), for A6: who may read invoices. A null token sends the request
  // anonymously.

  public APIResponse invoicesRequest(String token) {
    return request.get("/invoices", optionalAuth(token));
  }

  public APIResponse invoiceRequest(String id, String token) {
    return request.get("/invoices/" + id, optionalAuth(token));
  }

  public APIResponse invoicePdfRequest(String invoiceNumber, String token) {
    return request.get("/invoices/" + invoiceNumber + "/download-pdf", optionalAuth(token));
  }

  public APIResponse invoicePdfStatusRequest(String invoiceNumber, String token) {
    return request.get("/invoices/" + invoiceNumber + "/download-pdf-status", optionalAuth(token));
  }

  /**
   * Order statuses an admin can set (TS: INVOICE_STATUSES; pinned InvoiceController::updateStatus).
   */
  public static final List<String> INVOICE_STATUSES =
      List.of("AWAITING_FULFILLMENT", "ON_HOLD", "AWAITING_SHIPMENT", "SHIPPED", "COMPLETED");

  /** PUT /invoices/{id}/status; status is one of {@link #INVOICE_STATUSES}. */
  public void updateInvoiceStatus(String token, String id, String status, String message) {
    parse(
        request.put(
            "/invoices/" + id + "/status",
            json(Map.of("status", status, "status_message", message))
                .setHeader("Authorization", "Bearer " + token)),
        "PUT /invoices/{id}/status",
        Contracts::statusUpdated);
  }

  // --- admin: catalogue (TS: api.catalog, api.products.create) ---

  public List<Ref> brands() {
    return refs("/brands", Contracts.brandItem());
  }

  public List<Ref> categories() {
    return refs("/categories", Contracts.categoryItem());
  }

  public List<Ref> images() {
    return refs("/images", Contracts.imageItem());
  }

  /** POST /products; payload from {@link com.showcase.data.Products}. */
  public CreatedProduct createProduct(String token, Map<String, Object> product) {
    JsonObject body =
        parse(createProductRequest(token, product), "POST /products", Contracts::createdProduct);
    return GSON.fromJson(body, CreatedProduct.class);
  }

  /** POST /products, raw response. */
  public APIResponse createProductRequest(String token, Map<String, Object> product) {
    return request.post("/products", json(product).setHeader("Authorization", "Bearer " + token));
  }

  private List<Ref> refs(
      String path, java.util.function.BiConsumer<Contracts.Check, JsonObject> item) {
    APIResponse res = request.get(path);
    ensureOk(res, "GET " + path);
    JsonArray items = GSON.fromJson(res.text(), JsonArray.class);
    Contracts.require("GET " + path, Contracts.list(items, item));
    return GSON.fromJson(items, new TypeToken<List<Ref>>() {}.getType());
  }

  private static RequestOptions auth(String token) {
    return RequestOptions.create().setHeader("Authorization", "Bearer " + token);
  }

  private static RequestOptions optionalAuth(String token) {
    RequestOptions options = RequestOptions.create().setHeader("Accept", "application/json");
    return token == null ? options : options.setHeader("Authorization", "Bearer " + token);
  }

  /** POST /payment/check, raw response. No login needed. */
  public APIResponse paymentCheckRequest(Payment payment) {
    return request.post(
        "/payment/check",
        json(Map.of("payment_method", payment.method(), "payment_details", payment.details())));
  }

  /** Succeeds only for "Payment was successful". */
  public void checkPayment(Payment payment) {
    APIResponse res = paymentCheckRequest(payment);
    ensureOk(res, "POST /payment/check");
    String message = GSON.fromJson(res.text(), JsonObject.class).get("message").getAsString();
    if (!"Payment was successful".equals(message)) {
      throw new IllegalStateException("POST /payment/check: unexpected message " + message);
    }
  }

  /**
   * Field names of a rejected payment check, e.g. payment_details.credit_card_number (Laravel's 422
   * body).
   */
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
  private static JsonObject parse(
      APIResponse res, String label, Function<JsonObject, List<String>> contract) {
    ensureOk(res, label);
    JsonObject body = GSON.fromJson(res.text(), JsonObject.class);
    Contracts.require(label, contract.apply(body));
    return body;
  }

  private static void ensureOk(APIResponse res, String label) {
    if (res.ok()) return;
    // Include the start of the body: server errors are otherwise invisible in CI.
    String body = res.text();
    throw new IllegalStateException(
        label
            + " failed: "
            + res.status()
            + "\n"
            + body.substring(0, Math.min(500, body.length())));
  }

  @Override
  public void close() {
    request.dispose();
  }
}
