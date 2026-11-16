import { env } from '../../src/config/env';
import { expect, Tag, test } from '../../src/fixtures';

test.describe('Products API', () => {
  test('GET /products returns a paginated, well-formed list', { tag: [Tag.smoke] }, async ({ api }) => {
    const res = await api.getProducts();

    expect(res.current_page).toBe(1);
    expect(res.data.length).toBeGreaterThan(0);
    for (const product of res.data) {
      expect(product).toMatchObject({
        id: expect.any(String),
        name: expect.any(String),
        price: expect.any(Number),
      });
    }
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
