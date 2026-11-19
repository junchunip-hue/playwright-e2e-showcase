import { newProductData } from '../data/products';
import { expect, Given, Then, When } from '../fixtures';
import { need } from './need';

// Steps layer for the admin side of features/journeys/admin-to-customer.feature (S3) and guest-checkout.feature
// (S4). The admin works through the API; `adminToken` skips the scenario on the public demo (own Toolshop only).
// Java twin: java/src/test/java/com/showcase/steps/AdminSteps.java.

const PAID = 'When I pay with "..."';

Given('the admin has published a new product', async ({ api, adminToken, ctx }) => {
  const published = await api.products.create(adminToken, await newProductData(api));
  ctx.product = await api.products.get(published.id);
});

When('I search the catalogue for that product', async ({ homePage, ctx }) => {
  await homePage.open();
  await homePage.search(need(ctx.product, 'Given the admin has published a new product').name);
});

Then('the search shows only that product', async ({ homePage, ctx }) => {
  await expect(homePage.ui.productNames).toHaveText([need(ctx.product, 'Given the admin has published a new product').name]);
});

Then('the admin finds the order at the cart total', async ({ api, adminToken, ctx }) => {
  const invoice = await api.invoices.findByNumber(adminToken, need(ctx.invoiceNumber, PAID));
  expect(invoice.total).toBeCloseTo(need(ctx.cartTotal, 'When I review the cart'), 2);
  ctx.invoiceId = invoice.id;
});

When('the admin marks the order as shipped', async ({ api, adminToken, ctx }) => {
  ctx.shippedMessage = 'Shipped by the S3 journey';
  await api.invoices.updateStatus(adminToken, need(ctx.invoiceId, 'Then the admin finds the order at the cart total'), 'SHIPPED', ctx.shippedMessage);
});

Then('my invoices list shows the order', async ({ accountInvoicesPage, ctx }) => {
  await accountInvoicesPage.goto();
  await expect(accountInvoicesPage.row(need(ctx.invoiceNumber, PAID))).toBeVisible();
});

Then('my own view of the order says it was shipped', async ({ api, ctx }) => {
  const customer = need(ctx.customer, 'Given a newly registered customer');
  const token = await api.auth.login(customer.email, customer.password);
  const mine = await api.invoices.get(token, need(ctx.invoiceId, 'Then the admin finds the order at the cart total'));
  expect(mine).toMatchObject({ invoice_number: ctx.invoiceNumber, status: 'SHIPPED', status_message: ctx.shippedMessage });
});

Then("the order is billed to the guest's address", async ({ api, adminToken, ctx }) => {
  const guest = need(ctx.guest, 'Given guest details that were never registered');
  const invoice = await api.invoices.findByNumber(adminToken, need(ctx.invoiceNumber, PAID));
  expect(invoice).toMatchObject({
    billing_street: guest.address.street,
    billing_city: guest.address.city,
    billing_country: guest.address.country,
  });
});
