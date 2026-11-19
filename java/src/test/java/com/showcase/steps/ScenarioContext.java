package com.showcase.steps;

import com.showcase.data.Customers.Customer;

/**
 * What one scenario's steps hand to each other (e.g. the customer a Given step registered for a later When step).
 * PicoContainer creates a fresh one per scenario. TypeScript twin: the `ctx` fixture in src/fixtures/index.ts.
 */
public class ScenarioContext {
  public Customer customer;

  public Customer customer() {
    if (customer == null) {
      throw new IllegalStateException("No customer yet: add \"Given a newly registered customer\" before this step");
    }
    return customer;
  }
}
