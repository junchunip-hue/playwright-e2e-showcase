import { newProductData } from '../../src/data/products';
import { expect, Tag, test } from '../../src/fixtures';

// A8: what an admin publishes is immediately part of the public catalogue, with valid references and stock.
// Uses the admin account and creates data, so it runs against our own Toolshop only (adminToken fixture).

test.describe('Admin API', () => {
  test('A8: a product the admin publishes is listed, searchable and in stock', { tag: [Tag.smoke, Tag.admin] }, async ({ api, adminToken }) => {
    const data = await newProductData(api);

    const created = await api.products.create(adminToken, data);

    // GET /products/{id} is checked against ProductSchema: brand, category and image come back as objects.
    const product = await api.products.get(created.id);
    expect(product).toMatchObject({ name: data.name, price: data.price, in_stock: true, is_rental: false });
    expect(product.brand.id).toBe(data.brand_id);
    expect(product.category.id).toBe(data.category_id);

    const found = await api.products.search(data.name);
    expect(found.data.map((p) => p.id)).toEqual([created.id]);
  });
});
