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
import java.util.Map;

/**
 * One scenario's browser and API client: a fresh browser context (signed out) per scenario, on one
 * Playwright and Chromium per thread. PicoContainer creates it per scenario and injects it into the
 * step classes. The browser context opens on the first {@link #page()} call, so an API-only
 * scenario opens no browser and records no trace, as in TypeScript, where only a test that asks for
 * a page gets one; {@link Hooks} closes it. Same settings as the TypeScript `use` block in
 * playwright.config.ts: base URL, data-test ids, headless unless HEADED=1, trace kept only when the
 * scenario fails. TypeScript twin: the Playwright Test fixtures (page, api) that playwright-bdd
 * injects into the steps.
 */
public class PlaywrightContext {
  private static final ThreadLocal<Playwright> PLAYWRIGHT =
      ThreadLocal.withInitial(PlaywrightContext::startPlaywright);
  private static final ThreadLocal<Browser> BROWSER =
      ThreadLocal.withInitial(() ->
          PLAYWRIGHT
              .get()
              .chromium()
              .launch(
                  new BrowserType.LaunchOptions()
                      .setHeadless(!"1".equals(System.getenv("HEADED")))
                      // SLOW_MO=<ms> slows every action down, for a live demo; 0 otherwise.
                      .setSlowMo(slowMo())));

  private BrowserContext context;
  private Page page;
  private ApiClient api;
  private String adminToken;

  private static double slowMo() {
    String value = System.getenv("SLOW_MO");
    return value == null || value.isBlank() ? 0 : Double.parseDouble(value);
  }

  private static Playwright startPlaywright() {
    // create() would install every missing default browser (Firefox and WebKit too). The suite
    // uses only Chromium, installed once with the CLI (docs/java.md).
    Playwright playwright =
        Playwright.create(
            new Playwright.CreateOptions().setEnv(Map.of("PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD", "1")));
    playwright
        .selectors()
        .setTestIdAttribute("data-test"); // Toolshop exposes data-test -> getByTestId()
    return playwright;
  }

  private void open() {
    context = BROWSER.get().newContext(new Browser.NewContextOptions().setBaseURL(Env.BASE_URL));
    context
        .tracing()
        .start(new Tracing.StartOptions().setScreenshots(true).setSnapshots(true).setSources(true));
    page = context.newPage();
  }

  /**
   * Keeps the trace only for a failed scenario (open it with `show-trace`), like TypeScript's trace
   * on failure.
   */
  void close(boolean failed, String scenarioName) {
    if (context != null) {
      Tracing.StopOptions stop = new Tracing.StopOptions();
      if (failed) stop.setPath(Path.of("target", "playwright", slug(scenarioName), "trace.zip"));
      context.tracing().stop(stop);
      context.close();
    }
    if (api != null) api.close();
  }

  /** The scenario's page, opening the browser context (and its trace) on first use. */
  public Page page() {
    if (page == null) open();
    return page;
  }

  /**
   * The page if a step opened one, else null: for hooks that must not open a browser themselves.
   */
  Page pageIfOpen() {
    return page;
  }

  public Playwright playwright() {
    return PLAYWRIGHT.get();
  }

  /**
   * The API client for arrange and assert steps, created on first use and closed with the scenario.
   */
  public ApiClient api() {
    if (api == null) api = ApiClient.create(PLAYWRIGHT.get());
    return api;
  }

  /**
   * The seeded admin's token (own Toolshop only: @admin scenarios are skipped on the public demo,
   * see Hooks).
   */
  public String adminToken() {
    if (adminToken == null) adminToken = api().login(Env.ADMIN_EMAIL, Env.ADMIN_PASSWORD);
    return adminToken;
  }

  private static String slug(String name) {
    return name.replaceAll("[^A-Za-z0-9]+", "-").replaceAll("(^-|-$)", "");
  }
}
