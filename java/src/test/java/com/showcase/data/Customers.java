package com.showcase.data;

import com.showcase.api.ApiClient;
import java.util.Map;
import java.util.UUID;

/** Java twin of src/data/customers.ts: brand-new customers registered through the API. */
public final class Customers {
  public record Customer(String email, String password) {}

  private Customers() {}

  /**
   * Registers a throwaway customer. Used wherever a test must not touch the shared account, e.g. failed logins,
   * which count towards an account lock (HTTP 423).
   */
  public static Customer create(ApiClient api) {
    String id = UUID.randomUUID().toString().substring(0, 8);
    String email = "buyer." + id + "@example.com";
    // Meets the API policy (mixed case, digit, symbol) and is random, so the "not compromised" check passes.
    String password = "Pw!" + id + "Aa1";

    api.registerCustomer(Map.of(
        "first_name", "Test",
        "last_name", "Buyer" + id,
        "email", email,
        "password", password,
        "dob", "1990-01-01",
        "phone", "0612345678",
        "address", api.lookupAddress("US", "90210", "1")));
    return new Customer(email, password);
  }
}
