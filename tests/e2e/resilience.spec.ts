import { expect, Tag, test } from '../../src/fixtures';

// S6: what a customer sees when the backend is slow or fails, made reproducible with page.route (network mocking):
// the browser's request is held back or answered with a 500 before it reaches Toolshop, and released again to show
// recovery. Pinned behaviour: the app has no error state. A failed catalogue leaves the page blank, and a failed
// search is shown as "no results" (findings in docs/test-plan.md). These tests pin that, so a change is noticed.

/** GET /products (the catalogue list), not /products/{id} or /products/search. */
const catalogue = (url: URL): boolean => url.pathname.endsWith('/products');
const search = (url: URL): boolean => url.pathname.endsWith('/products/search');
const serverError = { status: 500, json: { message: 'Server Error' } };

test.describe('Resilience', () => {
  test('S6: a slow catalogue response still shows the products once it arrives', { tag: [Tag.regression] }, async ({ page, homePage }) => {
    let delayed = 0;
    await page.route(catalogue, async (route) => {
      const response = await route.fetch(); // the real answer from Toolshop...
      await new Promise((resolve) => setTimeout(resolve, 3_000)); // ...delivered 3 s late
      delayed++;
      await route.fulfill({ response });
    });

    await homePage.goto();

    // Web-first assertions wait for the late response; no fixed sleep in the test itself.
    await expect(homePage.productNames.first()).toBeVisible({ timeout: 10_000 });
    await expect(homePage.noResults).toBeHidden();
    expect(delayed, 'the catalogue request went through the delay').toBeGreaterThan(0);
  });

  test('S6: a failed catalogue request shows no products and no error; a reload recovers', { tag: [Tag.regression, Tag.negative] }, async ({ page, homePage }) => {
    await page.route(catalogue, (route) => route.fulfill(serverError));
    const failed = page.waitForResponse((res) => catalogue(new URL(res.url())));

    await homePage.goto();
    expect((await failed).status()).toBe(500);

    // Finding: no error message, no "no results" either: the list is simply empty.
    await expect(homePage.productNames).toHaveCount(0);
    await expect(homePage.noResults).toBeHidden();

    await page.unroute(catalogue);
    await page.reload();
    await expect(homePage.productNames.first()).toBeVisible();
  });

  test('S6: a failed search is shown as "no results"; the next search works', { tag: [Tag.regression, Tag.negative] }, async ({ page, homePage }) => {
    await homePage.goto();
    await expect(homePage.productNames.first()).toBeVisible();

    await page.route(search, (route) => route.fulfill(serverError));
    await homePage.submitSearch('pliers');

    // Finding: the server error reaches the customer as "There are no products found".
    await expect(homePage.noResults).toBeVisible();
    await expect(homePage.productNames).toHaveCount(0);

    await page.unroute(search);
    await homePage.search('pliers');
    await expect(homePage.productNames.first()).toContainText(/pliers/i);
  });
});
