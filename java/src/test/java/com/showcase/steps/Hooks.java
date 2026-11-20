package com.showcase.steps;

import com.showcase.config.Env;
import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import org.junit.jupiter.api.Assumptions;

/** Opens a fresh browser context before each scenario and closes it after (trace kept on failure). */
public class Hooks {
  private final PlaywrightContext playwright;

  public Hooks(PlaywrightContext playwright) {
    this.playwright = playwright;
  }

  /**
   * @admin scenarios change catalogue or orders (or need the admin to look them up): our own Toolshop only, never the
   * shared public demo. Same rule as the @Admin JUnit annotation and the TS adminToken fixture. Runs before the browser
   * opens, so a skipped scenario costs nothing.
   */
  @Before(value = "@admin", order = 0)
  public void ownToolshopOnly() {
    Assumptions.assumeFalse(Env.isPublicDemo(), "changes catalogue and orders: our own Toolshop only");
  }

  /** @own-toolshop scenarios need our own Toolshop (e.g. its background jobs): skipped on the public demo. */
  @Before(value = "@own-toolshop", order = 0)
  public void ownToolshopTag() {
    Assumptions.assumeFalse(Env.isPublicDemo(), "needs our own Toolshop (CI, local Docker), not the public demo");
  }

  @Before(order = 1)
  public void openBrowser() {
    playwright.open();
  }

  @After
  public void closeBrowser(Scenario scenario) {
    playwright.close(scenario.isFailed(), scenario.getName());
  }
}
