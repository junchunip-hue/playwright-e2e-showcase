import type { Locator, Page } from '@playwright/test';

/** Module layer: the contact form (/contact). Used by the quality checks (N1 visual, N2 accessibility). */
export class ContactModule {
  readonly submit: Locator;
  /** The form element has no data-test attribute; it is the form that contains the submit button. */
  readonly form: Locator;

  constructor(page: Page) {
    this.submit = page.getByTestId('contact-submit');
    this.form = page.locator('form').filter({ has: this.submit });
  }
}
