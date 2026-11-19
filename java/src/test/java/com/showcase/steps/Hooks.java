package com.showcase.steps;

import io.cucumber.java.After;
import io.cucumber.java.Before;
import io.cucumber.java.Scenario;

/** Opens a fresh browser context before each scenario and closes it after (trace kept on failure). */
public class Hooks {
  private final PlaywrightContext playwright;

  public Hooks(PlaywrightContext playwright) {
    this.playwright = playwright;
  }

  @Before
  public void openBrowser() {
    playwright.open();
  }

  @After
  public void closeBrowser(Scenario scenario) {
    playwright.close(scenario.isFailed(), scenario.getName());
  }
}
