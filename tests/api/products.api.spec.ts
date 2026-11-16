import { env } from '../../src/config/env';
import { createCustomer } from '../../src/data/customers';
import { expect, Tag, test } from '../../src/fixtures';

test.describe('Products API', () => {
  // Field names and types are validated by ProductPageSchema inside the client (see contracts.api.spec.ts);
  // this test checks the paging behaviour.
  test('A1: GET /products returns a paginated, well-formed list', { tag: [Tag.smoke] }, async ({ api }) => {
    const res = await api.products.list();

    expect(res.current_page).toBe(1);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.length).toBeLessThanOrEqual(res.per_page);
    expect(res.total).toBeGreaterThanOrEqual(res.data.length);
  });
});

test.describe('Auth API', () => {
  test('A2: valid credentials return an access token', { tag: [Tag.smoke] }, async ({ api }) => {
    const token = await api.auth.login(env.customer.email, env.customer.password);
    expect(token).toBeTruthy();
  });

  // Throwaway account: failed logins count towards an account lock (HTTP 423) on the shared customer.
  test('A3: wrong password is rejected with 401', { tag: [Tag.regression, Tag.negative] }, async ({ api }) => {
    const customer = await createCustomer(api);
    const res = await api.auth.loginRequest(customer.email, 'definitely-wrong-password');
    expect(res.status()).toBe(401);
  });
});
