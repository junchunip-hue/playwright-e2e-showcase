import type { APIResponse } from '@playwright/test';

import { expect, Then, When } from '../../fixtures';
import { need } from '../need';

// Steps layer for features/api/invoices.feature (A6).
// Java twin: java/src/test/java/com/showcase/steps/api/InvoicesApiSteps.java.

/** Ids that do not exist: authentication is checked before the lookup, so any id shows where the 401 comes from. */
const UNKNOWN_ID = '01JAAAAAAAAAAAAAAAAAAAAAAA';
const UNKNOWN_NUMBER = 'INV-2000000001';
const UNAUTHORIZED = { message: 'Unauthorized' };
const CUSTOMER = 'Given a newly registered customer';

Then(
  'every invoice route refuses an anonymous request with 401 and lets the signed-in one through',
  async ({ api, ctx }, table: { hashes(): Record<string, string>[] }) => {
    const customer = need(ctx.customer, CUSTOMER);
    const token = await api.auth.login(customer.email, customer.password);
    const send: Record<string, (t?: string) => Promise<APIResponse>> = {
      'GET /invoices': (t) => api.invoices.listRequest(t),
      'GET /invoices/{id}': (t) => api.invoices.getRequest(UNKNOWN_ID, t),
      'GET /invoices/{number}/download-pdf': (t) => api.invoices.pdfRequest(UNKNOWN_NUMBER, t),
      'GET /invoices/{number}/download-pdf-status': (t) => api.invoices.pdfStatusRequest(UNKNOWN_NUMBER, t),
    };
    for (const row of table.hashes()) {
      const route = need(send[row.route], `a request for "${row.route}" in invoices.steps.ts`);
      const anonymous = await route();
      expect(anonymous.status(), `${row.route} without a token`).toBe(401);
      expect(await anonymous.json(), `${row.route} body`).toEqual(UNAUTHORIZED);
      expect((await route(token)).status(), `${row.route} with a token`).toBe(Number(row['signed in']));
    }
  },
);

When('I list invoices with the token {string}', async ({ api, ctx }, token: string) => {
  ctx.response = await api.invoices.listRequest(token);
});

Then('the API answers 401 with the Unauthorized message', async ({ ctx }) => {
  const res = need(ctx.response, 'When I list invoices with the token "..."');
  expect(res.status()).toBe(401);
  expect(await res.json()).toEqual(UNAUTHORIZED);
});
