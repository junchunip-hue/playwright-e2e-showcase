import type { Locator, Page } from '@playwright/test';

/** Module layer: the shared footer, present on every page. Only locators, like the header. */
export class FooterModule {
  /** "vdev | Built YYYY-MM-DD | ...": the Toolshop build date, which changes with every CI build. */
  readonly buildInfo: Locator;

  constructor(page: Page) {
    this.buildInfo = page.getByText(/Built \d{4}-\d{2}-\d{2}/);
  }
}
