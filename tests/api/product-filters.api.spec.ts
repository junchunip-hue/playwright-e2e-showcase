import type { Product, ProductFilter } from '../../src/api/ApiClient';
import { expect, Tag, test } from '../../src/fixtures';

// A7: the catalogue's filters at API level (the UI's category and brand checkboxes, price slider and sort select call
// the same query). Every check is an invariant over the whole result ("every product is of this brand", "prices never
// go down"), not a fixed count, so it holds on the public demo too, where other people add products.
// Category and brand come from the first listed product, so each filter has at least one match. Results are paged
// (9 per page), so the checks read the page they get rather than looking for one product in it.

type Sort = NonNullable<ProductFilter['sort']>;
const SORTS: Sort[] = [
  { by: 'price', order: 'asc' },
  { by: 'price', order: 'desc' },
  { by: 'name', order: 'asc' },
  { by: 'name', order: 'desc' },
];

test.describe('Product filters API', { tag: [Tag.regression] }, () => {
  test('A7: a category or brand filter returns only products of it', async ({ api }) => {
    const sample = (await api.products.list()).data[0];

    await test.step(`category "${sample.category.name}"`, async () => {
      const page = await api.products.filter({ byCategory: [sample.category.id] });
      expect(page.total).toBeGreaterThan(0);
      expect(new Set(page.data.map((p) => p.category.id))).toEqual(new Set([sample.category.id]));
    });

    await test.step(`brand "${sample.brand.name}"`, async () => {
      const page = await api.products.filter({ byBrand: [sample.brand.id] });
      expect(page.total).toBeGreaterThan(0);
      expect(new Set(page.data.map((p) => p.brand.id))).toEqual(new Set([sample.brand.id]));
    });
  });

  test('A7: a price range returns only prices inside it, both ends included', async ({ api }) => {
    const sample = (await api.products.list()).data[0];

    const page = await api.products.filter({ price: { min: 10, max: 20 } });
    expect(page.total).toBeGreaterThan(0);
    for (const price of page.data.map((p) => p.price)) {
      expect(price).toBeGreaterThanOrEqual(10);
      expect(price).toBeLessThanOrEqual(20);
    }

    // A range of exactly one price still contains the product with that price.
    const exact = await api.products.filter({ price: { min: sample.price, max: sample.price } });
    expect(exact.data.map((p) => p.id)).toContain(sample.id);
  });

  for (const sort of SORTS) {
    test(`A7: sorting by ${sort.by} ${sort.order} orders the result across pages`, async ({ api }) => {
      // Two pages: the order must hold across the page boundary, not only within one page.
      const products = [
        ...(await api.products.filter({ sort, page: 1 })).data,
        ...(await api.products.filter({ sort, page: 2 })).data,
      ];
      expect(products.length).toBeGreaterThan(9);

      expect(products.map(sortKey(sort))).toEqual([...products].sort(compare(sort)).map(sortKey(sort)));
    });
  }

  test('A7: brand, price range and sort combine', async ({ api }) => {
    const sample = (await api.products.list()).data[0];
    const range = { min: 1, max: sample.price };

    const page = await api.products.filter({ byBrand: [sample.brand.id], price: range, sort: { by: 'price', order: 'desc' } });

    expect(page.data.map((p) => p.id)).toContain(sample.id);
    for (const product of page.data) {
      expect(product.brand.id).toBe(sample.brand.id);
      expect(product.price).toBeLessThanOrEqual(range.max);
    }
    expect(page.data.map((p) => p.price)).toEqual(page.data.map((p) => p.price).sort((a, b) => b - a));
  });
});

const sortKey = (sort: Sort) => (p: Product) => (sort.by === 'price' ? p.price : p.name);

/** The order the API promises; names compare like the database's case-insensitive collation. */
function compare(sort: Sort): (a: Product, b: Product) => number {
  const direction = sort.order === 'asc' ? 1 : -1;
  return (a, b) =>
    direction * (sort.by === 'price' ? a.price - b.price : a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
