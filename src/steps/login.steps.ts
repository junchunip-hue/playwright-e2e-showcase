import { env } from '../config/env';
import { expect, Given, Then, When } from '../fixtures';

// Steps layer for features/ui/login.feature: each step calls one page method or asserts on the page's module
// (`loginPage.ui`). No locators are created here. Java twin: java/src/test/java/com/showcase/steps/LoginSteps.java.

Given('I open the login page', async ({ loginPage }) => {
  await loginPage.open();
});

When('I sign in as the demo customer on the login page', async ({ loginPage }) => {
  await loginPage.signIn(env.customer.email, env.customer.password);
});

When('I sign in as that customer with a wrong password on the login page', async ({ loginPage, ctx }) => {
  if (!ctx.customer) throw new Error('No customer yet: add "Given a newly registered customer" before this step');
  await loginPage.signIn(ctx.customer.email, 'definitely-wrong-password');
});

Then('I am on my account page', async ({ page }) => {
  await expect(page).toHaveURL(/\/account/);
});

Then('the header shows my user menu', async ({ header }) => {
  await expect(header.userMenu).toBeVisible();
});

Then('I see a login error', async ({ loginPage }) => {
  await expect(loginPage.ui.error).toBeVisible();
});

Then('I am still on the login page', async ({ page }) => {
  await expect(page).toHaveURL(/\/auth\/login/);
});
