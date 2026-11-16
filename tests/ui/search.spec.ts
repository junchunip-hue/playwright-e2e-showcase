import { expect, Tag, test } from '../../src/fixtures';

test.describe('Product search', () => {
  test('U3: every result matches the search term', { tag: [Tag.smoke] }, async ({ homePage }) => {
    await homePage.goto();
    await homePage.search('pliers');

    const names = await homePage.productNames.allTextContents();
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) {
      expect(name.toLowerCase()).toContain('pliers');
    }
  });

  // Hybrid check: the UI must show what the backend returns (catches frontend filtering bugs).
  test('U4: UI results are consistent with the search API', { tag: [Tag.regression] }, async ({ homePage, api }) => {
    const apiNames = (await api.products.search('hammer')).data.map((p) => p.name.trim());

    await homePage.goto();
    await homePage.search('hammer');
    const uiNames = (await homePage.productNames.allTextContents()).map((n) => n.trim());

    expect(uiNames.length).toBeGreaterThan(0);
    expect(apiNames).toEqual(expect.arrayContaining(uiNames));
  });
});
