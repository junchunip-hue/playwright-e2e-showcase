package com.showcase.config;

import com.microsoft.playwright.junit.Options;
import com.microsoft.playwright.junit.OptionsFactory;
import java.nio.file.Path;

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
        .setTestIdAttribute("data-test")
        // Same policy as TS (trace on failure): a failing test leaves a trace.zip to open with `show-trace`.
        .setTrace(Options.Trace.RETAIN_ON_FAILURE)
        .setOutputDir(Path.of("target", "playwright"));
  }
}
