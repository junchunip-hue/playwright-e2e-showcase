package com.showcase.config;

import com.microsoft.playwright.junit.Options;
import com.microsoft.playwright.junit.OptionsFactory;

/**
 * Java counterpart of the `use` block in playwright.config.ts.
 * Referenced from every test class via {@code @UsePlaywright(ToolshopOptions.class)}.
 */
public class ToolshopOptions implements OptionsFactory {
  @Override
  public Options getOptions() {
    return new Options()
        .setBrowserName("chromium")
        .setHeadless(!"1".equals(System.getenv("HEADED")))
        .setBaseUrl(Env.BASE_URL)
        // Toolshop exposes data-test attributes -> getByTestId()
        .setTestIdAttribute("data-test");
  }
}
