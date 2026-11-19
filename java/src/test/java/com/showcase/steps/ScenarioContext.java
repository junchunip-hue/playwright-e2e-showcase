package com.showcase.steps;

import com.showcase.api.ApiClient.Product;
import com.showcase.data.Customers.Customer;
import com.showcase.data.Payments.InvalidCard;
import java.util.List;
import java.util.Map;

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
  /** Details of a guest who checks out without registering (S4): email, first_name, last_name, address. */
  public Map<String, Object> guest;
  /** The cart total shown in step 1 of checkout: the amount the invoice must have. */
  public Double cartTotal;
  /** The invoice number shown after the order was placed. */
  public String invoiceNumber;
  /** An invalid card entered in step 4 (S2 negative cases). */
  public InvalidCard invalidCard;
  /** The id of the order's invoice, as the admin found it (S3). */
  public String invoiceId;
  /** The status message the admin set when shipping (S3). */
  public String shippedMessage;

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

  /** A value an earlier step must have set; fails with the step to add when it is missing (TS: steps/need.ts). */
  public static <T> T need(T value, String missingStep) {
    if (value == null) throw new IllegalStateException("Missing an earlier step: add \"" + missingStep + "\" before this one");
    return value;
  }

  @SuppressWarnings("unchecked")
  public Map<String, String> guestAddress() {
    return (Map<String, String>) need(guest, "Given guest details that were never registered").get("address");
  }

  public List<String> searchApiNames() {
    if (searchApiNames == null) {
      throw new IllegalStateException("No API results yet: add \"Given the search API's results for ...\" first");
    }
    return searchApiNames;
  }
}
