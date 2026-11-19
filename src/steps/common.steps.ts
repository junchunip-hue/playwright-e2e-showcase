import { env } from '../config/env';
import { createCustomer } from '../data/customers';
import { expect, Given } from '../fixtures';

// Steps layer: Gherkin sentences bound to page methods. Steps used by more than one feature live here.
// Java twin: java/src/test/java/com/showcase/steps/CommonSteps.java.

Given('a newly registered customer', async ({ api, ctx }) => {
  ctx.customer = await createCustomer(api);
});

Given('a product that is in stock', async ({ api, ctx }) => {
  ctx.product = await api.products.findInStock();
});

Given('I am signed in as the demo customer', async ({ loginPage, page }) => {
  await loginPage.open();
  await loginPage.signIn(env.customer.email, env.customer.password);
  await expect(page).toHaveURL(/\/account/);
});
