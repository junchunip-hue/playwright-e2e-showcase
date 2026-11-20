import type { Page, Route } from '@playwright/test';

// Page layer: the network as the browser sees it, for S6 (network mocking). The browser's request is held back or
// answered with a 500 before it reaches Toolshop, and released again to show recovery. Each method also counts what
// it did, so a step can wait until the mocked answer really reached the app. Java twin: pages/NetworkPage.java.

/** GET /products (the catalogue list), not /products/{id} or /products/search. */
const catalogue = (url: URL): boolean => url.pathname.endsWith('/products');
const search = (url: URL): boolean => url.pathname.endsWith('/products/search');
const serverError = { status: 500, json: { message: 'Server Error' } };

export class NetworkPage {
  /** Catalogue answers delivered late. */
  delayed = 0;
  /** Catalogue requests answered with a 500. */
  catalogueFailures = 0;

  constructor(private readonly page: Page) {}

  async delayCatalogue(ms: number): Promise<void> {
    await this.page.route(catalogue, async (route) => {
      // The real answer from Toolshop, copied into memory before the delay: the fetched response object can be
      // disposed while we wait (Firefox, nightly 2026-11-19: "Fetch response has been disposed").
      const response = await route.fetch();
      const answer = { status: response.status(), headers: response.headers(), body: await response.body() };
      await new Promise((resolve) => setTimeout(resolve, ms));
      this.delayed++;
      await route.fulfill(answer);
    });
  }

  async failCatalogue(): Promise<void> {
    await this.page.route(catalogue, async (route: Route) => {
      this.catalogueFailures++;
      await route.fulfill(serverError);
    });
  }

  async restoreCatalogue(): Promise<void> {
    await this.page.unroute(catalogue);
  }

  async failSearch(): Promise<void> {
    await this.page.route(search, (route) => route.fulfill(serverError));
  }

  async restoreSearch(): Promise<void> {
    await this.page.unroute(search);
  }
}
