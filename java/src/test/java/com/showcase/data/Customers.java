package com.showcase.data;

import com.showcase.api.ApiClient;
import java.util.Map;
import java.util.UUID;

/** Java twin of src/data/customers.ts: brand-new customers registered through the API. */
public final class Customers {
  /** {@code address} uses the register API's field names (street, house_number, city, state, country, postal_code). */
  public record Customer(String email, String password, Map<String, String> address) {}

  private Customers() {}

  /**
   * Registers a throwaway customer. Every test that needs an account gets its own, so tests never share carts or
   * orders, and failed logins (which count towards an account lock, HTTP 423) never hit the shared account.
   */
  public static Customer create(ApiClient api) {
    String id = UUID.randomUUID().toString().substring(0, 8);
    String email = "buyer." + id + "@example.com";
    // Meets the API policy (mixed case, digit, symbol) and is random, so the "not compromised" check passes.
    String password = "Pw!" + id + "Aa1";
    // Toolshop validates at checkout that city/state belong to the postcode, so the address comes from its lookup.
    Map<String, String> address = api.lookupAddress("US", "90210", "1");

    api.registerCustomer(Map.of(
        "first_name", "Test",
        "last_name", "Buyer" + id,
        "email", email,
        "password", password,
        "dob", "1990-01-01",
        "phone", "0612345678",
        "address", address));
    return new Customer(email, password, address);
  }
}
