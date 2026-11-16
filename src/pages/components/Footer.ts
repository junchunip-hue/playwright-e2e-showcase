import type { Locator, Page } from '@playwright/test';

/** Shared footer, present on every page. */
export class Footer {
  /** "vdev | Built YYYY-MM-DD | ...": the Toolshop build date, which changes with every CI build. */
  readonly buildInfo: Locator;

  constructor(page: Page) {
    this.buildInfo = page.getByText(/Built \d{4}-\d{2}-\d{2}/);
  }
}
