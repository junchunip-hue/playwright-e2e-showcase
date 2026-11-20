import type { APIResponse } from '@playwright/test';

import { INVOICE_STATUSES, type InvoiceStatus } from '../../api/schemas';
import { newProductData } from '../../data/products';
import { expect, Given, Then, When } from '../../fixtures';
import { expectKnownDefect } from '../../known-defects';
import { need } from '../need';

// Steps layer for features/api/invoices.feature (A6) and permissions.feature (A10, A11: known defects, ADR 0010).
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

// --- A10, A11: known defects ---

When('that customer tries to publish a product through the API', async ({ api, ctx }) => {
  const customer = need(ctx.customer, CUSTOMER);
  const token = await api.auth.login(customer.email, customer.password);
  // Intended: 403. Today: 201, because StoreProduct::authorize() returns true and only DELETE requires the admin role.
  ctx.response = await api.products.createRequest(token, await newProductData(api));
});

Given('an order of someone else, in a status the API accepts', async ({ api, adminToken, ctx }) => {
  const isAccepted = (status: string): status is InvoiceStatus =>
    (INVOICE_STATUSES as readonly string[]).includes(status);
  const order = (await api.invoices.list(adminToken)).data.find((i) => isAccepted(i.status));
  expect(order, 'a seeded invoice with a status the API accepts').toBeDefined();
  ctx.order = { id: order!.id, status: order!.status as InvoiceStatus };
});

When('that customer sets that order to the status it already has', async ({ api, ctx }) => {
  const customer = need(ctx.customer, CUSTOMER);
  const order = need(ctx.order, 'Given an order of someone else, in a status the API accepts');
  const token = await api.auth.login(customer.email, customer.password);
  // Intended: 403. Today: 200, because the route only requires a signed-in user and checks neither role nor owner.
  ctx.response = await api.invoices.updateStatusRequest(token, order.id, order.status);
});

Then(
  'the API still answers {int} instead of {int}, known defect {string} for {string}',
  async ({ ctx }, today: number, intended: number, summary: string, label: string) => {
    expectKnownDefect(need(ctx.response, 'a When step that sends the request'), label, { summary, intended, today });
  },
);

Then('the order is unchanged', async ({ api, adminToken, ctx }) => {
  const order = need(ctx.order, 'Given an order of someone else, in a status the API accepts');
  expect((await api.invoices.get(adminToken, order.id)).status, 'the order is unchanged').toBe(order.status);
});
