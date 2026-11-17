package com.showcase.data;

import com.showcase.api.ApiClient;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/** Java twin of src/data/customers.ts: brand-new customers registered through the API. */
public final class Customers {
  /** {@code address} uses the register API's field names (street, house_number, city, state, country, postal_code). */
  public record Customer(String email, String password, Map<String, String> address) {}

  private Customers() {}

  /**
   * Valid registration data for a brand-new customer, not yet registered (TS: newCustomerData).
   * Tests override single fields (e.g. a weak password) to exercise one validation rule at a time.
   */
  public static Map<String, Object> data(ApiClient api, Map<String, Object> overrides) {
    String id = UUID.randomUUID().toString().substring(0, 8);
    Map<String, Object> data = new HashMap<>(Map.of(
        "first_name", "Test",
        "last_name", "Buyer" + id,
        "email", "buyer." + id + "@example.com",
        // Meets the API policy (mixed case, digit, symbol) and is random, so the "not compromised" check passes.
        "password", "Pw!" + id + "Aa1",
        "dob", "1990-01-01",
        "phone", "0612345678",
        // Toolshop validates at checkout that city/state belong to the postcode, so the address comes from its lookup.
        "address", api.lookupAddress("US", "90210", "1")));
    data.putAll(overrides);
    return data;
  }

  /**
   * Registers a throwaway customer. Every test that needs an account gets its own, so tests never share carts or
   * orders, and failed logins (which count towards an account lock, HTTP 423) never hit the shared account.
   */
  @SuppressWarnings("unchecked")
  public static Customer create(ApiClient api) {
    Map<String, Object> data = data(api, Map.of());
    api.registerCustomer(data);
    return new Customer((String) data.get("email"), (String) data.get("password"), (Map<String, String>) data.get("address"));
  }
}
