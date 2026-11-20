import { env } from '../config/env';
import { createCustomer } from '../data/customers';
import { expect, Given, When } from '../fixtures';
import { need } from './need';

// Steps layer: Gherkin sentences bound to page methods. Steps used by more than one feature live here.
// Wording and placement rules: docs/coding-rules.md#gherkin-steps; every step: docs/steps.md.
// Java twin: java/src/test/java/com/showcase/steps/CommonSteps.java.

Given('a newly registered customer', async ({ api, ctx }) => {
  ctx.customer = await createCustomer(api);
});

Given('a product that is in stock', async ({ api, ctx }) => {
  ctx.product = await api.products.findInStock();
});

Given('I have signed in as the demo customer on the login page', async ({ loginPage, page }) => {
  await loginPage.open();
  await loginPage.signIn(env.customer.email, env.customer.password);
  await expect(page).toHaveURL(/\/account/);
});

Given('I have signed in as that customer on the login page', async ({ loginPage, page, ctx }) => {
  const customer = need(ctx.customer, 'Given a newly registered customer');
  await loginPage.open();
  await loginPage.signIn(customer.email, customer.password);
  await expect(page).toHaveURL(/\/account$/);
});

// The catalogue page is Toolshop's home page (pages/home.page.ts).
Given('I open the catalogue page', async ({ homePage }) => {
  await homePage.open();
});

When('I search the catalogue page for {string}', async ({ homePage }, term: string) => {
  await homePage.search(term);
});
