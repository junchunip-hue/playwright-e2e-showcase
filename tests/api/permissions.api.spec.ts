import { INVOICE_STATUSES, type InvoiceStatus } from '../../src/api/schemas';
import { isPublicDemo } from '../../src/config/env';
import { createCustomer } from '../../src/data/customers';
import { newProductData } from '../../src/data/products';
import { expect, Tag, test } from '../../src/fixtures';
import { expectKnownDefect } from '../../src/known-defects';

// A10/A11: admin actions must be refused to customers. The pinned Toolshop does not refuse them (found while
// building S3, see docs/test-plan.md), so each test tracks the defect with expectKnownDefect: green while the API
// behaves exactly as today, red once it is fixed or behaves any other way. A8 and S3 send the same requests as the
// admin, so a broken payload fails there instead of hiding here.

test.describe('Permissions API', () => {
  test.skip(isPublicDemo, 'can change catalogue and orders while the defects exist: our own Toolshop only');

  test('A10: a customer cannot publish a product', { tag: [Tag.smoke, Tag.negative, Tag.admin] }, async ({ api }) => {
    const customer = await createCustomer(api);
    const token = await api.auth.login(customer.email, customer.password);

    const res = await api.products.createRequest(token, await newProductData(api));

    // Intended: 403. Today: 201, because StoreProduct::authorize() returns true and only DELETE requires the admin role.
    expectKnownDefect(res, 'POST /products as a customer', {
      summary: 'POST /products checks no role',
      intended: 403,
      today: 201,
    });
  });

  test('A11: a customer cannot change the status of an order', { tag: [Tag.smoke, Tag.negative, Tag.admin] }, async ({ api, adminToken }) => {
    // Someone else's order: a seeded invoice in a status the API accepts, as the admin sees it.
    const order = (await api.invoices.list(adminToken)).data.find((i) => isInvoiceStatus(i.status));
    expect(order, 'a seeded invoice with a status the API accepts').toBeDefined();
    const { id, status } = order as { id: string; status: InvoiceStatus };

    const customer = await createCustomer(api);
    const token = await api.auth.login(customer.email, customer.password);
    // Sends the status the order already has, so the request changes nothing even while the defect exists.
    const res = await api.invoices.updateStatusRequest(token, id, status);

    // Intended: 403. Today: 200, because the route only requires a signed-in user and checks neither role nor owner.
    expectKnownDefect(res, 'PUT /invoices/{id}/status as another customer', {
      summary: 'PUT /invoices/{id}/status checks neither role nor ownership',
      intended: 403,
      today: 200,
    });
    expect((await api.invoices.get(adminToken, id)).status, 'the order is unchanged').toBe(status);
  });
});

const isInvoiceStatus = (status: string): status is InvoiceStatus => (INVOICE_STATUSES as readonly string[]).includes(status);
