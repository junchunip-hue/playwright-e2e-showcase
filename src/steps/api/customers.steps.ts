import { env } from '../../config/env';
import { newCustomerData } from '../../data/customers';
import { expect, Then, When } from '../../fixtures';
import { need } from '../need';

// Steps layer for features/api/auth.feature, registration.feature and the postcode part of contracts.feature.
// Java twin: java/src/test/java/com/showcase/steps/api/CustomersApiSteps.java.

const RESPONSE = 'a When step that sends the request';

When('the demo customer signs in through the API', async ({ api, ctx }) => {
  ctx.token = await api.auth.login(env.customer.email, env.customer.password);
});

Then('an access token is returned', async ({ ctx }) => {
  expect(ctx.token).toBeTruthy();
});

When('that customer signs in through the API with a wrong password', async ({ api, ctx }) => {
  ctx.response = await api.auth.loginRequest(
    need(ctx.customer, 'Given a newly registered customer').email,
    'definitely-wrong-password',
  );
});

Then('the API answers {int}', async ({ ctx }, status: number) => {
  expect(need(ctx.response, RESPONSE).status()).toBe(status);
});

When('I register a new customer with the password {string}', async ({ api, ctx }, password: string) => {
  ctx.response = await api.customers.registerRequest(await newCustomerData(api, { password }));
});

When('I register another customer with the same email', async ({ api, ctx }) => {
  const existing = need(ctx.customer, 'Given a newly registered customer');
  ctx.response = await api.customers.registerRequest(await newCustomerData(api, { email: existing.email }));
});

Then('only the password is rejected, for every unmet rule', async ({ api, ctx }) => {
  const errors = await api.validationErrors(need(ctx.response, RESPONSE), 'POST /users/register');
  expect(Object.keys(errors)).toEqual(['password']);
  expect(errors.password).toEqual(
    expect.arrayContaining([
      expect.stringMatching(/at least 8 characters/),
      expect.stringMatching(/uppercase and one lowercase/),
      expect.stringMatching(/at least one symbol/),
      expect.stringMatching(/at least one number/),
    ]),
  );
});

Then('only the password is rejected, as having appeared in a data leak', async ({ api, ctx }) => {
  const errors = await api.validationErrors(need(ctx.response, RESPONSE), 'POST /users/register');
  expect(errors).toEqual({ password: [expect.stringMatching(/appeared in a data leak/)] });
});

Then('only the email is rejected, as already existing', async ({ api, ctx }) => {
  const errors = await api.validationErrors(need(ctx.response, RESPONSE), 'POST /users/register');
  expect(errors).toEqual({ email: [expect.stringMatching(/already exists/)] });
});

When('I look up the US postcode {string}', async ({ api, ctx }, postcode: string) => {
  ctx.address = await api.addresses.lookup('US', postcode, '1');
});

Then(
  'the address is in country {string} with postcode {string}',
  async ({ ctx }, country: string, postcode: string) => {
    const address = need(ctx.address, 'When I look up the US postcode "..."');
    expect(address.country).toBe(country);
    expect(address.postal_code).toBe(postcode);
  },
);
