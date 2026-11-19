package com.showcase.steps;

import com.showcase.data.Customers;
import io.cucumber.java.en.Given;

/**
 * Steps layer: Gherkin sentences bound to page methods. Steps used by more than one feature live here.
 * TypeScript twin: src/steps/common.steps.ts.
 */
public class CommonSteps {
  private final PlaywrightContext playwright;
  private final ScenarioContext ctx;

  public CommonSteps(PlaywrightContext playwright, ScenarioContext ctx) {
    this.playwright = playwright;
    this.ctx = ctx;
  }

  @Given("a newly registered customer")
  public void aNewlyRegisteredCustomer() {
    ctx.customer = Customers.create(playwright.api());
  }
}
