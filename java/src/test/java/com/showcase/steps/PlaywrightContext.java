package com.showcase.steps;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.microsoft.playwright.Playwright;
import com.microsoft.playwright.Tracing;
import com.showcase.api.ApiClient;
import com.showcase.config.Env;
import java.nio.file.Path;

/**
 * One scenario's browser and API client: a fresh browser context (signed out) per scenario, on one Playwright and
 * Chromium per thread. PicoContainer creates it per scenario and injects it into the step classes; {@link Hooks}
 * opens and closes it. Same settings as config/ToolshopOptions (the JUnit tests) and the TypeScript `use` block:
 * base URL, data-test ids, headless unless HEADED=1, trace kept only when the scenario fails.
 * TypeScript twin: the Playwright Test fixtures (page, api) that playwright-bdd injects into the steps.
 */
public class PlaywrightContext {
  private static final ThreadLocal<Playwright> PLAYWRIGHT = ThreadLocal.withInitial(PlaywrightContext::startPlaywright);
  private static final ThreadLocal<Browser> BROWSER =
      ThreadLocal.withInitial(
          () ->
              PLAYWRIGHT.get().chromium().launch(new BrowserType.LaunchOptions().setHeadless(!"1".equals(System.getenv("HEADED")))));

  private BrowserContext context;
  private Page page;
  private ApiClient api;

  private static Playwright startPlaywright() {
    Playwright playwright = Playwright.create();
    playwright.selectors().setTestIdAttribute("data-test"); // Toolshop exposes data-test -> getByTestId()
    return playwright;
  }

  void open() {
    context = BROWSER.get().newContext(new Browser.NewContextOptions().setBaseURL(Env.BASE_URL));
    context.tracing().start(new Tracing.StartOptions().setScreenshots(true).setSnapshots(true).setSources(true));
    page = context.newPage();
  }

  /** Keeps the trace only for a failed scenario, like Options.Trace.RETAIN_ON_FAILURE in the JUnit tests. */
  void close(boolean failed, String scenarioName) {
    if (context == null) return;
    Tracing.StopOptions stop = new Tracing.StopOptions();
    if (failed) stop.setPath(Path.of("target", "playwright", slug(scenarioName), "trace.zip"));
    context.tracing().stop(stop);
    context.close();
    if (api != null) api.close();
  }

  public Page page() {
    return page;
  }

  public Playwright playwright() {
    return PLAYWRIGHT.get();
  }

  /** The API client for arrange and assert steps, created on first use and closed with the scenario. */
  public ApiClient api() {
    if (api == null) api = ApiClient.create(PLAYWRIGHT.get());
    return api;
  }

  private static String slug(String name) {
    return name.replaceAll("[^A-Za-z0-9]+", "-").replaceAll("(^-|-$)", "");
  }
}
