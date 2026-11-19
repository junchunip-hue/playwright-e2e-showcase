package com.showcase.pages;

import com.microsoft.playwright.Page;
import com.showcase.modules.LoginModule;

/**
 * Page layer: what a user does on the login page, built on the module's locators. Steps call these methods and
 * assert on {@link #ui} (the module); they never create locators themselves.
 * TypeScript twin: src/pages/login.page.ts.
 */
public class LoginPage {
  private final Page page;
  /** The locators, for the steps' assertions. */
  public final LoginModule ui;

  public LoginPage(Page page) {
    this.page = page;
    this.ui = new LoginModule(page);
  }

  public void open() {
    page.navigate("/auth/login");
  }

  public void signIn(String email, String password) {
    ui.email.fill(email);
    ui.password.fill(password);
    ui.submit.click();
  }
}
