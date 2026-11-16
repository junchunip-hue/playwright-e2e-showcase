import type { Locator, Page } from '@playwright/test';

export class ContactPage {
  readonly submit: Locator;
  readonly form: Locator;

  constructor(private readonly page: Page) {
    this.submit = page.getByTestId('contact-submit');
    // The form element has no data-test attribute; it is the form that contains the submit button.
    this.form = page.locator('form').filter({ has: this.submit });
  }

  async goto(): Promise<void> {
    await this.page.goto('/contact');
  }
}
