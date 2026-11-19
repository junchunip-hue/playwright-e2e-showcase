import type { Locator, Page } from '@playwright/test';

/**
 * Module layer: the locators of the login page, and nothing else. Locators are lazy (nothing is looked up until
 * an action or assertion uses them), so declaring them in the constructor is safe.
 * Java twin: java/src/test/java/com/showcase/modules/LoginModule.java.
 */
export class LoginModule {
  /** The email + password form (also shown in step 2 of checkout). */
  readonly form: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;
  /** "Invalid email or password", shown after a failed sign-in. */
  readonly error: Locator;

  constructor(page: Page) {
    this.form = page.getByTestId('login-form');
    this.email = page.getByTestId('email');
    this.password = page.getByTestId('password');
    this.submit = page.getByTestId('login-submit');
    this.error = page.getByTestId('login-error');
  }
}
