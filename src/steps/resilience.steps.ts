import { expect, Given, Then, When } from '../fixtures';

// Steps layer for features/journeys/resilience.feature (S6). The mocking itself lives in pages/network.page.ts.
// Java twin: java/src/test/java/com/showcase/steps/ResilienceSteps.java.

Given('the catalogue answers {int} seconds late', async ({ network }, seconds: number) => {
  await network.delayCatalogue(seconds * 1000);
});

Given('the catalogue answers with a server error', async ({ network }) => {
  await network.failCatalogue();
});

Given('the search answers with a server error', async ({ network }) => {
  await network.failSearch();
});

When('I open the product catalogue', async ({ homePage }) => {
  await homePage.open();
});

When('the catalogue works again and I reload the page', async ({ network, homePage }) => {
  await network.restoreCatalogue();
  await homePage.reload();
});

When('I submit a search for {string}', async ({ homePage }, term: string) => {
  await homePage.submitSearch(term); // waits for the (failing) answer, whatever its status
});

When('the search works again and I search for {string}', async ({ network, homePage }, term: string) => {
  await network.restoreSearch();
  await homePage.search(term);
});

// Web-first assertions wait for a late answer: up to 10 s, enough for the 3 s delay; no fixed sleep.
Then('products are shown', async ({ homePage }) => {
  await expect(homePage.ui.productNames.first()).toBeVisible({ timeout: 10_000 });
});

Then('no products are shown', async ({ homePage }) => {
  await expect(homePage.ui.productNames).toHaveCount(0);
});

Then('no {string} message is shown', async ({ homePage }, message: string) => {
  expect(message, 'the only message this step knows').toBe('no results');
  await expect(homePage.ui.noResults).toBeHidden();
});

Then('a {string} message is shown', async ({ homePage }, message: string) => {
  expect(message, 'the only message this step knows').toBe('no results');
  await expect(homePage.ui.noResults).toBeVisible();
});

Then('the catalogue answer went through the delay', async ({ network }) => {
  expect(network.delayed, 'catalogue answers delivered late').toBeGreaterThan(0);
});

// Waits until the mocked 500 really reached the app, so "no products" is checked after the failure, not before.
Then('the catalogue request got the server error', async ({ network }) => {
  await expect.poll(() => network.catalogueFailures, { message: 'catalogue requests answered with 500' }).toBeGreaterThan(0);
});

Then('the first product shown has {string} in its name', async ({ homePage }, term: string) => {
  await expect(homePage.ui.productNames.first()).toContainText(new RegExp(term, 'i'));
});
