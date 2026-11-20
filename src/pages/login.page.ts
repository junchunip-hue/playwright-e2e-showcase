import type { Page } from '@playwright/test';

import { LoginModule } from '../modules/login.module';

/**
 * Page layer: what a user does on the login page, built on the module's locators. Steps call these methods and
 * assert on `ui` (the module); they never create locators themselves.
 * Java twin: java/src/test/java/com/showcase/pages/LoginPage.java.
 */
export class LoginPage {
  /** The locators, for the steps' assertions. */
  readonly ui: LoginModule;

  constructor(private readonly page: Page) {
    this.ui = new LoginModule(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/auth/login');
  }

  async signIn(email: string, password: string): Promise<void> {
    await this.ui.email.fill(email);
    await this.ui.password.fill(password);
    await this.ui.submit.click();
  }
}
