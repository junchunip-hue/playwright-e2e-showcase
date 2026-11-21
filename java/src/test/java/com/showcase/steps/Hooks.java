package com.showcase.steps;

import com.microsoft.playwright.Page;
import com.showcase.config.Env;
import io.cucumber.java.After;
import io.cucumber.java.AfterStep;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;
import org.junit.jupiter.api.Assumptions;

/**
 * Opens a fresh browser context before each scenario and closes it after (trace kept on failure),
 * and takes the failure screenshot at the step that failed.
 */
public class Hooks {
  private final PlaywrightContext playwright;
  private boolean screenshotTaken;

  public Hooks(PlaywrightContext playwright) {
    this.playwright = playwright;
  }

  /**
   * @admin scenarios change catalogue or orders (or need the admin to look them up): our own
   *     Toolshop only, never the shared public demo. Same rule as the TS ownToolshopOnly and
   *     adminToken fixtures. Runs before the browser opens, so a skipped scenario costs nothing.
   */
  @Before(value = "@admin", order = 0)
  public void ownToolshopOnly() {
    Assumptions.assumeFalse(
        Env.isPublicDemo(), "changes catalogue and orders: our own Toolshop only");
  }

  /**
   * @own-toolshop scenarios need our own Toolshop (e.g. its background jobs): skipped on the public
   *     demo.
   */
  @Before(value = "@own-toolshop", order = 0)
  public void ownToolshopTag() {
    Assumptions.assumeFalse(
        Env.isPublicDemo(), "needs our own Toolshop (CI, local Docker), not the public demo");
  }

  @Before(order = 1)
  public void openBrowser() {
    playwright.open();
  }

  /**
   * Failure evidence (TypeScript twin: src/fixtures/evidence.ts): right after the step that failed,
   * a full-page screenshot as it was, attached to that step. Cucumber runs this hook after every
   * step; only the first failure takes one, and a scenario without a page (API only, about:blank)
   * has nothing to show. report/ScenarioLog stores it with the failed step for the Java report.
   */
  @AfterStep
  public void screenshotFailedStep(Scenario scenario) {
    if (!scenario.isFailed() || screenshotTaken) return;
    screenshotTaken = true;
    Page page = playwright.page();
    if (page == null || page.isClosed() || "about:blank".equals(page.url())) return;
    try {
      byte[] png =
          page.screenshot(new Page.ScreenshotOptions().setFullPage(true).setTimeout(5_000));
      scenario.attach(png, "image/png", "screenshot at failure");
    } catch (RuntimeException e) {
      // The page may be gone (crashed, navigated mid-shot): the step's error is the evidence then.
    }
  }

  @After
  public void closeBrowser(Scenario scenario) {
    playwright.close(scenario.isFailed(), scenario.getName());
  }
}
