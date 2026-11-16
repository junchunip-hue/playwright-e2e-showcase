import type { Locator, Page } from '@playwright/test';
import { LoginForm } from './components/LoginForm';

export class LoginPage {
  readonly form: LoginForm;
  readonly error: Locator;

  constructor(private readonly page: Page) {
    this.form = new LoginForm(page);
    this.error = page.getByTestId('login-error');
  }

  async goto(): Promise<void> {
    await this.page.goto('/auth/login');
  }

  async login(email: string, password: string): Promise<void> {
    await this.form.signIn(email, password);
  }
}
