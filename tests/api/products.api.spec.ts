import { env } from '../../src/config/env';
import { expect, Tag, test } from '../../src/fixtures';

test.describe('Products API', () => {
  // Field names and types are validated by ProductPageSchema inside the client (see contracts.api.spec.ts);
  // this test checks the paging behaviour.
  test('GET /products returns a paginated, well-formed list', { tag: [Tag.smoke] }, async ({ api }) => {
    const res = await api.getProducts();

    expect(res.current_page).toBe(1);
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.length).toBeLessThanOrEqual(res.per_page);
    expect(res.total).toBeGreaterThanOrEqual(res.data.length);
  });
});

test.describe('Auth API', () => {
  test('valid credentials return an access token', { tag: [Tag.smoke] }, async ({ api }) => {
    const token = await api.login(env.customer.email, env.customer.password);
    expect(token).toBeTruthy();
  });

  test('wrong password is rejected with 401', { tag: [Tag.regression, Tag.negative] }, async ({ api }) => {
    const res = await api.loginRequest(env.customer.email, 'definitely-wrong-password');
    expect(res.status()).toBe(401);
  });
});
