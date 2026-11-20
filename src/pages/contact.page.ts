import type { Page } from '@playwright/test';

import { ContactModule } from '../modules/contact.module';

/** Page layer: the contact page. Only opened by the quality checks (N1, N2), so no scenario steps use it. */
export class ContactPage {
  readonly ui: ContactModule;

  constructor(private readonly page: Page) {
    this.ui = new ContactModule(page);
  }

  async open(): Promise<void> {
    await this.page.goto('/contact');
  }
}
