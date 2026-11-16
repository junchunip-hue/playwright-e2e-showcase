import type { Locator, Page } from '@playwright/test';

/**
 * Email + password sign-in form. The same component appears on the login page and in step 2 of checkout,
 * so both page objects reuse it instead of repeating the locators.
 */
export class LoginForm {
  readonly root: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('login-form');
    this.email = page.getByTestId('email');
    this.password = page.getByTestId('password');
    this.submit = page.getByTestId('login-submit');
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.email.fill(email);
    await this.password.fill(password);
    await this.submit.click();
  }
}
