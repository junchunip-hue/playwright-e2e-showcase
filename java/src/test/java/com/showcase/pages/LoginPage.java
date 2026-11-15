package com.showcase.pages;

import com.microsoft.playwright.Locator;
import com.microsoft.playwright.Page;

/** Java twin of src/pages/LoginPage.ts. */
public class LoginPage {
  private final Page page;
  public final Locator email;
  public final Locator password;
  public final Locator submit;
  public final Locator error;

  public LoginPage(Page page) {
    this.page = page;
    this.email = page.getByTestId("email");
    this.password = page.getByTestId("password");
    this.submit = page.getByTestId("login-submit");
    this.error = page.getByTestId("login-error");
  }

  public void navigate() {
    page.navigate("/auth/login");
  }

  public void login(String emailValue, String passwordValue) {
    email.fill(emailValue);
    password.fill(passwordValue);
    submit.click();
  }
}
