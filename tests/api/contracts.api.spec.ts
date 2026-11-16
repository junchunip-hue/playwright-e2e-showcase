import { ProductSchema } from '../../src/api/schemas';
import { createCustomer } from '../../src/data/customers';
import { expect, Tag, test } from '../../src/fixtures';

// A0: API response contracts. ApiClient validates every response against src/api/schemas.ts and throws with
// the offending field paths, so each call below is a contract check; the assertions cover what a schema cannot
// (relationships between responses, empty results). Fresh customers are used, never the shared demo account.

test.describe('API contracts', { tag: [Tag.smoke] }, () => {
  test('product list, product detail and search agree on the Product contract', async ({ api }) => {
    const page = await api.getProducts();
    const listed = page.data[0];

    const detail = await api.getProduct(listed.id);
    expect(detail).toMatchObject({ id: listed.id, name: listed.name, price: listed.price });

    // Search uses ProductSearchItemSchema: same contract minus category.slug (a known API inconsistency).
    const search = await api.searchProducts(listed.name);
    expect(search.data.map((p) => p.id)).toContain(listed.id);
  });

  test('an empty search still returns a valid paginator', async ({ api }) => {
    const res = await api.searchProducts('no-such-product-zz9');
    expect(res.total).toBe(0);
    expect(res.data).toEqual([]);
    expect(res.from).toBeNull();
  });

  test('login and invoice list for a new customer', async ({ api }) => {
    const customer = await createCustomer(api);
    const token = await api.login(customer.email, customer.password);

    const invoices = await api.getInvoices(token);
    expect(invoices.total).toBe(0);
  });

  test('postcode lookup returns a usable address', async ({ api }) => {
    const address = await api.lookupAddress('US', '90210', '1');
    expect(address.country).toBe('US');
    expect(address.postal_code).toBe('90210');
  });
});

// The guard itself: proves a contract break is reported with the field path, not swallowed.
test.describe('Schema guard', { tag: [Tag.smoke] }, () => {
  test('rejects a retyped field and names it', async ({ api }) => {
    const valid = (await api.getProducts()).data[0];

    const result = ProductSchema.safeParse({ ...valid, price: String(valid.price) });

    expect(result.success).toBe(false);
    expect(result.error?.issues.map((i) => i.path.join('.'))).toEqual(['price']);
  });
});
