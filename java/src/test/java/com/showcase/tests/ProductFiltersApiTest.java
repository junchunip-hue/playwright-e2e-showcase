package com.showcase.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microsoft.playwright.Playwright;
import com.showcase.annotations.RegressionCases;
import com.showcase.annotations.RegressionTest;
import com.showcase.annotations.ToolshopTest;
import com.showcase.api.ApiClient;
import com.showcase.api.ApiClient.Paginated;
import com.showcase.api.ApiClient.Product;
import com.showcase.api.ApiClient.ProductFilter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Named;
import org.junit.jupiter.params.provider.MethodSource;

/**
 * Mirrors tests/api/product-filters.api.spec.ts (A7): the catalogue's filters at API level. Every check is an
 * invariant over the whole result, not a fixed count, so it holds on the public demo too. Category and brand come from
 * the first listed product, so each filter has at least one match. Results are paged (9 per page).
 */
@ToolshopTest
@DisplayName("Product filters API")
class ProductFiltersApiTest {
  /**
   * Names compare like the database's case-insensitive collation, where a space sorts before letters ("Wood Saw"
   * before "Wooden Workbench"). java.text.Collator ignores spaces, so it is not used here.
   */
  private static final Comparator<String> NAMES = String.CASE_INSENSITIVE_ORDER;

  record Sort(String by, String order) {}

  static Stream<Named<Sort>> sorts() {
    return Stream.of(new Sort("price", "asc"), new Sort("price", "desc"), new Sort("name", "asc"), new Sort("name", "desc"))
        .map(s -> Named.of(s.by() + " " + s.order(), s));
  }

  @RegressionTest
  @DisplayName("A7: a category or brand filter returns only products of it")
  void categoryAndBrand(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Product sample = api.getProducts(1).data().get(0);

      Paginated<Product> byCategory = api.filterProducts(ProductFilter.page(1).byCategory(sample.category().id()));
      assertTrue(byCategory.total() > 0, "category " + sample.category().name() + " has products");
      assertEquals(Set.of(sample.category().id()), byCategory.data().stream().map(p -> p.category().id()).collect(Collectors.toSet()));

      Paginated<Product> byBrand = api.filterProducts(ProductFilter.page(1).byBrand(sample.brand().id()));
      assertTrue(byBrand.total() > 0, "brand " + sample.brand().name() + " has products");
      assertEquals(Set.of(sample.brand().id()), byBrand.data().stream().map(p -> p.brand().id()).collect(Collectors.toSet()));
    }
  }

  @RegressionTest
  @DisplayName("A7: a price range returns only prices inside it, both ends included")
  void priceRange(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Product sample = api.getProducts(1).data().get(0);

      Paginated<Product> page = api.filterProducts(ProductFilter.page(1).price(10, 20));
      assertTrue(page.total() > 0, "products between 10 and 20");
      for (Product p : page.data()) assertTrue(p.price() >= 10 && p.price() <= 20, p.name() + " costs " + p.price());

      // A range of exactly one price still contains the product with that price.
      Paginated<Product> exact = api.filterProducts(ProductFilter.page(1).price(sample.price(), sample.price()));
      assertTrue(exact.data().stream().anyMatch(p -> p.id().equals(sample.id())), sample.name() + " in its own price");
    }
  }

  @RegressionCases
  @MethodSource("sorts")
  @DisplayName("A7: sorting orders the result across pages")
  void sorting(Sort sort, Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      // Two pages: the order must hold across the page boundary, not only within one page.
      List<Product> products = new ArrayList<>(api.filterProducts(ProductFilter.page(1).sort(sort.by(), sort.order())).data());
      products.addAll(api.filterProducts(ProductFilter.page(2).sort(sort.by(), sort.order())).data());
      assertTrue(products.size() > 9, "two pages of products");

      Comparator<Product> promised = "price".equals(sort.by())
          ? Comparator.comparingDouble(Product::price)
          : Comparator.comparing(Product::name, NAMES);
      if ("desc".equals(sort.order())) promised = promised.reversed();
      List<Product> expected = products.stream().sorted(promised).toList();
      assertEquals(keys(expected, sort), keys(products, sort));
    }
  }

  @RegressionTest
  @DisplayName("A7: brand, price range and sort combine")
  void combined(Playwright playwright) {
    try (ApiClient api = ApiClient.create(playwright)) {
      Product sample = api.getProducts(1).data().get(0);

      Paginated<Product> page = api.filterProducts(
          ProductFilter.page(1).byBrand(sample.brand().id()).price(1, sample.price()).sort("price", "desc"));

      assertTrue(page.data().stream().anyMatch(p -> p.id().equals(sample.id())), sample.name() + " in the result");
      for (Product p : page.data()) {
        assertEquals(sample.brand().id(), p.brand().id(), p.name() + " brand");
        assertTrue(p.price() <= sample.price(), p.name() + " costs " + p.price());
      }
      List<Double> prices = page.data().stream().map(Product::price).toList();
      assertEquals(prices.stream().sorted(Comparator.reverseOrder()).toList(), prices);
    }
  }

  private static List<Object> keys(List<Product> products, Sort sort) {
    return products.stream().map(p -> "price".equals(sort.by()) ? (Object) p.price() : p.name()).toList();
  }
}
