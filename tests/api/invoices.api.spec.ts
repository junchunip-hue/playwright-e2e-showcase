import { createCustomer } from '../../src/data/customers';
import { expect, Tag, test } from '../../src/fixtures';

// A6: every invoice route needs a signed-in user. Each request is sent twice, without and with a valid token: the
// anonymous one is refused with 401, the signed-in one reaches the lookup. That contrast shows the 401 comes from the
// missing token, not from the id. The ids below do not exist (any id works: authentication is checked first), so the
// test needs no order and reads nobody's data.
const UNKNOWN_ID = '01JAAAAAAAAAAAAAAAAAAAAAAA';
const UNKNOWN_NUMBER = 'INV-2000000001';
const UNAUTHORIZED = { message: 'Unauthorized' };

test.describe('Invoices API: authentication', () => {
  test('A6: invoices cannot be read without a token', { tag: [Tag.smoke, Tag.negative] }, async ({ api }) => {
    const customer = await createCustomer(api);
    const token = await api.auth.login(customer.email, customer.password);

    const routes = [
      { label: 'GET /invoices', send: (t?: string) => api.invoices.listRequest(t), signedIn: 200 },
      { label: 'GET /invoices/{id}', send: (t?: string) => api.invoices.getRequest(UNKNOWN_ID, t), signedIn: 404 },
      { label: 'GET /invoices/{number}/download-pdf', send: (t?: string) => api.invoices.pdfRequest(UNKNOWN_NUMBER, t), signedIn: 404 },
      { label: 'GET /invoices/{number}/download-pdf-status', send: (t?: string) => api.invoices.pdfStatusRequest(UNKNOWN_NUMBER, t), signedIn: 400 },
    ];

    for (const route of routes) {
      await test.step(route.label, async () => {
        const anonymous = await route.send();
        expect(anonymous.status(), 'without a token').toBe(401);
        expect(await anonymous.json()).toEqual(UNAUTHORIZED);
        expect((await route.send(token)).status(), 'with a token').toBe(route.signedIn);
      });
    }
  });

  test('A6: a malformed token is refused like a missing one', { tag: [Tag.regression, Tag.negative] }, async ({ api }) => {
    const res = await api.invoices.listRequest('not-a-jwt');

    expect(res.status()).toBe(401);
    expect(await res.json()).toEqual(UNAUTHORIZED);
  });
});
