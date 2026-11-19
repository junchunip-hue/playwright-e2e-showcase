package com.showcase.modules;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/**
 * Module layer: the locators of the login page, and nothing else. Locators are lazy (nothing is looked up until an
 * action or assertion uses them), so declaring them in the constructor is safe.
 * TypeScript twin: src/modules/login.module.ts.
 */
public class LoginModule {
  /** The email + password form (also shown in step 2 of checkout). */
  public final Locator form;
  public final Locator email;
  public final Locator password;
  public final Locator submit;
  /** "Invalid email or password", shown after a failed sign-in. */
  public final Locator error;

  public LoginModule(Page page) {
    this.form = page.getByTestId("login-form");
    this.email = page.getByTestId("email");
    this.password = page.getByTestId("password");
    this.submit = page.getByTestId("login-submit");
    this.error = page.getByTestId("login-error");
  }
}
