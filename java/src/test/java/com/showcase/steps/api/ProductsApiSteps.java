package com.showcase.steps.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.google.gson.JsonObject;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.CreatedProduct;
import com.showcase.api.ApiClient.Paginated;
import com.showcase.api.ApiClient.Product;
import com.showcase.api.ApiClient.ProductFilter;
import com.showcase.api.Contracts;
import com.showcase.data.Products;
import com.showcase.steps.PlaywrightContext;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Steps layer for features/api/contracts.feature (product part), products.feature, product-filters.feature and
 * admin.feature. The API client is the page layer here: it sends the request and validates the response contract.
 * TypeScript twin: src/steps/api/products.steps.ts.
 */
public class ProductsApiSteps {
  /** Names compare like the database's case-insensitive collation. */
  private static final Comparator<String> NAMES = String.CASE_INSENSITIVE_ORDER;
  private final PlaywrightContext playwright;
  // Per-scenario state of these steps (PicoContainer creates this class per scenario).
  private Product sample;
  private Paginated<Product> page;
  private List<String> contractProblems;
  private String sortBy;
  private String sortOrder;
  private List<Product> sorted;
  private Map<String, Object> newProduct;
  private CreatedProduct created;

  public ProductsApiSteps(PlaywrightContext playwright) {
    this.playwright = playwright;
  }

  private ApiClient api() {
    return playwright.api();
  }

  private Product sample() {
    if (sample == null) throw new IllegalStateException("Missing an earlier step: add \"Given the first product of the catalogue list\"");
    return sample;
  }

  @Given("the first product of the catalogue list")
  public void theFirstProductOfTheCatalogueList() {
    sample = api().getProducts(1).data().get(0);
  }

  // --- A0: contracts ---

  @Then("its detail has the same id, name and price")
  public void itsDetailHasTheSameIdNameAndPrice() {
    Product detail = api().getProduct(sample().id());
    assertEquals(sample().id(), detail.id());
    assertEquals(sample().name(), detail.name());
    assertEquals(sample().price(), detail.price());
  }

  @Then("searching for its name finds it")
  public void searchingForItsNameFindsIt() {
    List<String> found = api().searchProducts(sample().name()).data().stream().map(Product::id).toList();
    assertTrue(found.contains(sample().id()), "search for \"" + sample().name() + "\" should find " + sample().id());
  }

  @When("I search the API for {string}")
  public void iSearchTheApiFor(String term) {
    page = api().searchProducts(term);
  }

  @Then("the result is an empty paginator")
  public void theResultIsAnEmptyPaginator() {
    assertEquals(0, page.total());
    assertEquals(List.of(), page.data());
    assertNull(page.from());
  }

  @When("its price is sent back as a string")
  public void itsPriceIsSentBackAsAString() {
    JsonObject valid = api().getProductJson(sample().id());
    JsonObject tampered = valid.deepCopy();
    tampered.addProperty("price", valid.get("price").getAsString());
    contractProblems = Contracts.product(tampered, true);
  }

  @Then("the contract check reports only the field {string}")
  public void theContractCheckReportsOnlyTheField(String field) {
    assertEquals(1, contractProblems.size(), contractProblems.toString());
    assertTrue(contractProblems.get(0).startsWith(field + ": expected a number"), contractProblems.get(0));
  }

  // --- A1: paging ---

  @When("I request the first page of products")
  public void iRequestTheFirstPageOfProducts() {
    page = api().getProducts(1);
  }

  @Then("it is page 1 with at least one and at most a page of products")
  public void itIsPage1WithAtLeastOneAndAtMostAPageOfProducts() {
    assertEquals(1, page.currentPage());
    assertTrue(!page.data().isEmpty(), "no products returned");
    assertTrue(page.data().size() <= page.perPage(), "more products than a page");
    assertTrue(page.total() >= page.data().size(), "total below the page size");
  }

  // --- A7: filters (invariants over the whole result, not fixed counts) ---

  @Then("filtering by its category returns only products of that category")
  public void filteringByItsCategory() {
    Paginated<Product> byCategory = api().filterProducts(ProductFilter.page(1).byCategory(sample().category().id()));
    assertTrue(byCategory.total() > 0, "category " + sample().category().name() + " has products");
    assertEquals(Set.of(sample().category().id()), byCategory.data().stream().map(p -> p.category().id()).collect(Collectors.toSet()));
  }

  @Then("filtering by its brand returns only products of that brand")
  public void filteringByItsBrand() {
    Paginated<Product> byBrand = api().filterProducts(ProductFilter.page(1).byBrand(sample().brand().id()));
    assertTrue(byBrand.total() > 0, "brand " + sample().brand().name() + " has products");
    assertEquals(Set.of(sample().brand().id()), byBrand.data().stream().map(p -> p.brand().id()).collect(Collectors.toSet()));
  }

  @Then("filtering by prices from {int} to {int} returns only prices inside that range")
  public void filteringByPrices(int min, int max) {
    Paginated<Product> inRange = api().filterProducts(ProductFilter.page(1).price(min, max));
    assertTrue(inRange.total() > 0, "products between " + min + " and " + max);
    for (Product p : inRange.data()) assertTrue(p.price() >= min && p.price() <= max, p.name() + " costs " + p.price());
  }

  @Then("filtering by exactly its price finds it")
  public void filteringByExactlyItsPriceFindsIt() {
    Paginated<Product> exact = api().filterProducts(ProductFilter.page(1).price(sample().price(), sample().price()));
    assertTrue(exact.data().stream().anyMatch(p -> p.id().equals(sample().id())), sample().name() + " in its own price");
  }

  @When("^I request two pages sorted by (price|name) (asc|desc)$")
  public void iRequestTwoPagesSortedBy(String by, String order) {
    sortBy = by;
    sortOrder = order;
    sorted = new ArrayList<>(api().filterProducts(ProductFilter.page(1).sort(by, order)).data());
    sorted.addAll(api().filterProducts(ProductFilter.page(2).sort(by, order)).data());
  }

  @Then("the products are in that order across both pages")
  public void theProductsAreInThatOrderAcrossBothPages() {
    assertTrue(sorted.size() > 9, "two pages of products");
    Comparator<Product> promised = "price".equals(sortBy) ? Comparator.comparingDouble(Product::price) : Comparator.comparing(Product::name, NAMES);
    if ("desc".equals(sortOrder)) promised = promised.reversed();
    assertEquals(keys(sorted.stream().sorted(promised).toList()), keys(sorted));
  }

  @Then("filtering by its brand, prices up to its own and price descending finds it, matching every filter")
  public void filteringCombined() {
    Paginated<Product> combined = api().filterProducts(
        ProductFilter.page(1).byBrand(sample().brand().id()).price(1, sample().price()).sort("price", "desc"));
    assertTrue(combined.data().stream().anyMatch(p -> p.id().equals(sample().id())), sample().name() + " matches its own filters");
    for (Product p : combined.data()) {
      assertEquals(sample().brand().id(), p.brand().id(), p.name() + " brand");
      assertTrue(p.price() <= sample().price(), p.name() + " costs " + p.price());
    }
    List<Double> prices = combined.data().stream().map(Product::price).toList();
    assertEquals(prices.stream().sorted(Comparator.reverseOrder()).toList(), prices);
  }

  // --- A8: what the admin publishes ---

  @When("the admin publishes a new product through the API")
  public void theAdminPublishesANewProduct() {
    newProduct = Products.newProductData(api());
    created = api().createProduct(playwright.adminToken(), newProduct);
  }

  @Then("the product detail shows it in stock, with its brand and category")
  public void theProductDetailShowsItInStock() {
    JsonObject product = api().getProductJson(created.id());
    assertEquals(newProduct.get("name"), product.get("name").getAsString());
    assertEquals((double) newProduct.get("price"), product.get("price").getAsDouble(), 0.001);
    assertTrue(product.get("in_stock").getAsBoolean(), "in_stock");
    assertEquals(newProduct.get("brand_id"), product.getAsJsonObject("brand").get("id").getAsString());
    assertEquals(newProduct.get("category_id"), product.getAsJsonObject("category").get("id").getAsString());
  }

  @Then("searching for its name finds only that product")
  public void searchingForItsNameFindsOnlyThatProduct() {
    List<String> found = api().searchProducts((String) newProduct.get("name")).data().stream().map(Product::id).toList();
    assertEquals(List.of(created.id()), found);
  }

  private List<Object> keys(List<Product> products) {
    return products.stream().map(p -> "price".equals(sortBy) ? (Object) p.price() : p.name()).toList();
  }
}
