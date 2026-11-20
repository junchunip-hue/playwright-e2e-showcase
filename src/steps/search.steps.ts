import { expect, Given, Then } from '../fixtures';

// Steps layer for features/ui/search.feature. Java twin: java/src/test/java/com/showcase/steps/SearchSteps.java.

Given("the search API's results for {string}", async ({ api, ctx }, term: string) => {
  ctx.searchApiNames = (await api.products.search(term)).data.map((p) => p.name.trim());
});

Then('every product shown has {string} in its name', async ({ homePage }, term: string) => {
  const names = await homePage.productNames();
  expect(names.length, 'products shown').toBeGreaterThan(0);
  for (const name of names) expect(name.toLowerCase()).toContain(term.toLowerCase());
});

Then('every product shown is one the search API returned', async ({ homePage, ctx }) => {
  if (!ctx.searchApiNames) throw new Error(`No API results yet: add "Given the search API's results for ..." first`);
  const shown = await homePage.productNames();
  expect(shown.length, 'products shown').toBeGreaterThan(0);
  expect(ctx.searchApiNames).toEqual(expect.arrayContaining(shown));
});
