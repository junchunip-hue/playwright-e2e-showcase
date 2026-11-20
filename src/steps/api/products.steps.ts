import type { Product, ProductFilter } from '../../api/ApiClient';
import { ProductSchema } from '../../api/schemas';
import { newProductData } from '../../data/products';
import { expect, Given, Then, When } from '../../fixtures';
import { need } from '../need';

// Steps layer for features/api/contracts.feature (product part), products.feature, product-filters.feature and
// admin.feature. The API client is the page layer here: it sends the request and validates the response contract.
// Java twin: java/src/test/java/com/showcase/steps/api/ProductsApiSteps.java.

const SAMPLE = 'Given the first product of the catalogue list';
type Sort = NonNullable<ProductFilter['sort']>;

Given('the first product of the catalogue list', async ({ api, ctx }) => {
  ctx.product = (await api.products.list()).data[0];
});

// --- A0: contracts ---

Then('its detail has the same id, name and price', async ({ api, ctx }) => {
  const listed = need(ctx.product, SAMPLE);
  expect(await api.products.get(listed.id)).toMatchObject({ id: listed.id, name: listed.name, price: listed.price });
});

Then('searching for its name finds it', async ({ api, ctx }) => {
  const listed = need(ctx.product, SAMPLE);
  // Search uses ProductSearchItemSchema: the same contract minus category.slug (a known API inconsistency).
  expect((await api.products.search(listed.name)).data.map((p) => p.id)).toContain(listed.id);
});

When('I search the API for {string}', async ({ api, ctx }, term: string) => {
  ctx.searchResult = await api.products.search(term);
});

Then('the result is an empty paginator', async ({ ctx }) => {
  const result = need(ctx.searchResult, 'When I search the API for "..."');
  expect(result.total).toBe(0);
  expect(result.data).toEqual([]);
  expect(result.from).toBeNull();
});

When('its price is sent back as a string', async ({ ctx }) => {
  const valid = need(ctx.product, SAMPLE);
  const result = ProductSchema.safeParse({ ...valid, price: String(valid.price) });
  ctx.contractProblems = result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
});

Then('the contract check reports only the field {string}', async ({ ctx }, field: string) => {
  expect(need(ctx.contractProblems, 'When its price is sent back as a string')).toEqual([field]);
});

// --- A1: paging ---

When('I request the first page of products', async ({ api, ctx }) => {
  ctx.productPage = await api.products.list();
});

Then('it is page 1 with at least one and at most a page of products', async ({ ctx }) => {
  const page = need(ctx.productPage, 'When I request the first page of products');
  expect(page.current_page).toBe(1);
  expect(page.data.length).toBeGreaterThan(0);
  expect(page.data.length).toBeLessThanOrEqual(page.per_page);
  expect(page.total).toBeGreaterThanOrEqual(page.data.length);
});

// --- A7: filters (invariants over the whole result, not fixed counts) ---

Then('filtering by its category returns only products of that category', async ({ api, ctx }) => {
  const sample = need(ctx.product, SAMPLE);
  const page = await api.products.filter({ byCategory: [sample.category.id] });
  expect(page.total).toBeGreaterThan(0);
  expect(new Set(page.data.map((p) => p.category.id))).toEqual(new Set([sample.category.id]));
});

Then('filtering by its brand returns only products of that brand', async ({ api, ctx }) => {
  const sample = need(ctx.product, SAMPLE);
  const page = await api.products.filter({ byBrand: [sample.brand.id] });
  expect(page.total).toBeGreaterThan(0);
  expect(new Set(page.data.map((p) => p.brand.id))).toEqual(new Set([sample.brand.id]));
});

Then('filtering by prices from {int} to {int} returns only prices inside that range', async ({ api }, min: number, max: number) => {
  const page = await api.products.filter({ price: { min, max } });
  expect(page.total).toBeGreaterThan(0);
  for (const price of page.data.map((p) => p.price)) {
    expect(price).toBeGreaterThanOrEqual(min);
    expect(price).toBeLessThanOrEqual(max);
  }
});

Then('filtering by exactly its price finds it', async ({ api, ctx }) => {
  const sample = need(ctx.product, SAMPLE);
  const exact = await api.products.filter({ price: { min: sample.price, max: sample.price } });
  expect(exact.data.map((p) => p.id)).toContain(sample.id);
});

When(/^I request two pages sorted by (price|name) (asc|desc)$/, async ({ api, ctx }, by: Sort['by'], order: Sort['order']) => {
  ctx.sort = { by, order };
  ctx.products = [
    ...(await api.products.filter({ sort: ctx.sort, page: 1 })).data,
    ...(await api.products.filter({ sort: ctx.sort, page: 2 })).data,
  ];
});

Then('the products are in that order across both pages', async ({ ctx }) => {
  const sort = need(ctx.sort, 'When I request two pages sorted by ...');
  const products = need(ctx.products, 'When I request two pages sorted by ...');
  expect(products.length).toBeGreaterThan(9);
  expect(products.map(sortKey(sort))).toEqual([...products].sort(compare(sort)).map(sortKey(sort)));
});

Then('filtering by its brand, prices up to its own and price descending finds it, matching every filter', async ({ api, ctx }) => {
  const sample = need(ctx.product, SAMPLE);
  const range = { min: 1, max: sample.price };
  const page = await api.products.filter({ byBrand: [sample.brand.id], price: range, sort: { by: 'price', order: 'desc' } });
  expect(page.data.map((p) => p.id)).toContain(sample.id);
  for (const product of page.data) {
    expect(product.brand.id).toBe(sample.brand.id);
    expect(product.price).toBeLessThanOrEqual(range.max);
  }
  expect(page.data.map((p) => p.price)).toEqual(page.data.map((p) => p.price).sort((a, b) => b - a));
});

// --- A8: what the admin publishes ---

When('the admin publishes a new product through the API', async ({ api, adminToken, ctx }) => {
  ctx.newProduct = await newProductData(api);
  ctx.product = await api.products.get((await api.products.create(adminToken, ctx.newProduct)).id);
});

Then('the product detail shows it in stock, with its brand and category', async ({ ctx }) => {
  const data = need(ctx.newProduct, 'When the admin publishes a new product through the API');
  // GET /products/{id} is checked against ProductSchema: brand, category and image come back as objects.
  const product = need(ctx.product, 'When the admin publishes a new product through the API');
  expect(product).toMatchObject({ name: data.name, price: data.price, in_stock: true, is_rental: false });
  expect(product.brand.id).toBe(data.brand_id);
  expect(product.category.id).toBe(data.category_id);
});

Then('searching for its name finds only that product', async ({ api, ctx }) => {
  const product = need(ctx.product, 'When the admin publishes a new product through the API');
  expect((await api.products.search(product.name)).data.map((p) => p.id)).toEqual([product.id]);
});

const sortKey = (sort: Sort) => (p: Product) => (sort.by === 'price' ? p.price : p.name);

/** The order the API promises; names compare like the database's case-insensitive collation. */
function compare(sort: Sort): (a: Product, b: Product) => number {
  const direction = sort.order === 'asc' ? 1 : -1;
  return (a, b) => direction * (sort.by === 'price' ? a.price - b.price : a.name.localeCompare(b.name, 'en', { sensitivity: 'base' }));
}
