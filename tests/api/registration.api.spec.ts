import { createCustomer, newCustomerData } from '../../src/data/customers';
import { expect, Tag, test } from '../../src/fixtures';

// A4/A5: registration rules of POST /users/register (pinned source: StoreCustomer request).
// Each test breaks exactly one rule on otherwise valid data and checks that only that field is reported.

test.describe('Registration API', () => {
  test('A4: weak password is rejected with every unmet rule', { tag: [Tag.smoke, Tag.negative] }, async ({ api }) => {
    const res = await api.registerRequest(await newCustomerData(api, { password: 'abc' }));

    expect(res.status()).toBe(422);
    const errors = await api.validationErrors(res, 'POST /users/register');
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

  // The leak check calls the external Have I Been Pwned API from the Toolshop backend; Laravel lets the password
  // through when that service is unreachable. External dependency, so nightly rather than the PR gate.
  test('A4: password from a known data leak is rejected', { tag: [Tag.regression, Tag.negative] }, async ({ api }) => {
    // Satisfies every local rule, but appears in public breach lists.
    const res = await api.registerRequest(await newCustomerData(api, { password: 'Password1!' }));

    expect(res.status()).toBe(422);
    const errors = await api.validationErrors(res, 'POST /users/register');
    expect(errors).toEqual({ password: [expect.stringMatching(/appeared in a data leak/)] });
  });

  // Toolshop answers 409 Conflict here, not 422: the duplicate is a state conflict, not malformed input.
  test('A5: duplicate email is rejected with 409', { tag: [Tag.smoke, Tag.negative] }, async ({ api }) => {
    const existing = await createCustomer(api);

    const res = await api.registerRequest(await newCustomerData(api, { email: existing.email }));

    expect(res.status()).toBe(409);
    const errors = await api.validationErrors(res, 'POST /users/register');
    expect(errors).toEqual({ email: [expect.stringMatching(/already exists/)] });
  });
});
