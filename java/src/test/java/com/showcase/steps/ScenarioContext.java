package com.showcase.steps;

import com.showcase.api.ApiClient.Product;
import com.showcase.data.Customers.Customer;
import java.util.List;

/**
 * What one scenario's steps hand to each other (e.g. the customer a Given step registered for a later When step).
 * PicoContainer creates a fresh one per scenario. TypeScript twin: the `ctx` fixture in src/fixtures/index.ts.
 */
public class ScenarioContext {
  public Customer customer;
  /** A product picked through the API (e.g. one in stock right now). */
  public Product product;
  /** Product names the search API returned, to compare with what the UI shows. */
  public List<String> searchApiNames;

  public Customer customer() {
    if (customer == null) {
      throw new IllegalStateException("No customer yet: add \"Given a newly registered customer\" before this step");
    }
    return customer;
  }

  public Product product() {
    if (product == null) throw new IllegalStateException("No product yet: add \"Given a product that is in stock\" first");
    return product;
  }

  public List<String> searchApiNames() {
    if (searchApiNames == null) {
      throw new IllegalStateException("No API results yet: add \"Given the search API's results for ...\" first");
    }
    return searchApiNames;
  }
}
