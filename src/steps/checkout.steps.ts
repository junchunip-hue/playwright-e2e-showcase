import { newCustomerData } from '../data/customers';
import { invalidCardNamed, paymentFor } from '../data/payments';
import { expect, Given, Then, When } from '../fixtures';
import { need } from './need';

// Steps layer for features/journeys/checkout.feature and guest-checkout.feature: the checkout journey, one wizard
// step per sentence. The waits live in pages/checkout.page.ts; the outcome is asserted here, in the UI and the API.
// Java twin: java/src/test/java/com/showcase/steps/CheckoutSteps.java.

const CUSTOMER = 'Given a newly registered customer';
const PRODUCT = 'Given a product that is in stock';

Given('guest details that were never registered', async ({ api, ctx }) => {
  ctx.guest = await newCustomerData(api);
});

When('I add that product to the cart', async ({ productPage, header, ctx }) => {
  const product = need(ctx.product, PRODUCT);
  await productPage.open(product.id);
  await productPage.addToCart();
  await expect(header.cartQuantity).toHaveText('1');
});

When('I review the cart', async ({ checkoutPage, ctx }) => {
  ctx.cartTotal = await checkoutPage.reviewCart([need(ctx.product, PRODUCT).name]);
});

When('I sign in as that customer during checkout', async ({ checkoutPage, ctx }) => {
  const customer = need(ctx.customer, CUSTOMER);
  await checkoutPage.signIn(customer.email, customer.password);
});

When('I continue as that guest', async ({ checkoutPage, ctx }) => {
  await checkoutPage.continueAsGuest(need(ctx.guest, 'Given guest details that were never registered'));
});

When('I confirm my saved billing address', async ({ checkoutPage, ctx }) => {
  await checkoutPage.confirmAddress(need(ctx.customer, CUSTOMER).address);
});

When("I enter the guest's billing address for the postcode lookup", async ({ checkoutPage, ctx }) => {
  await checkoutPage.enterAddressForLookup(need(ctx.guest, 'Given guest details that were never registered').address);
});

When('I pay with {string}', async ({ checkoutPage, ctx }, method: string) => {
  ctx.invoiceNumber = await checkoutPage.pay(paymentFor(method));
});

When('I enter the payment details of a {string}', async ({ checkoutPage, ctx }, card: string) => {
  ctx.invalidCard = invalidCardNamed(card);
  await checkoutPage.enterPayment(ctx.invalidCard.payment);
});

Then("that customer's invoice exists at the cart total", async ({ api, ctx }) => {
  const customer = need(ctx.customer, CUSTOMER);
  const invoiceNumber = need(ctx.invoiceNumber, 'When I pay with "..."');
  const token = await api.auth.login(customer.email, customer.password);
  const invoice = (await api.invoices.list(token)).data.find((i) => i.invoice_number === invoiceNumber);
  expect(invoice, `invoice ${invoiceNumber} for ${customer.email}`).toBeDefined();
  expect(invoice!.total).toBeCloseTo(need(ctx.cartTotal, 'When I review the cart'), 2);
});

Then("the invoice is billed to the customer's country", async ({ api, ctx }) => {
  const customer = need(ctx.customer, CUSTOMER);
  const token = await api.auth.login(customer.email, customer.password);
  const invoice = await api.invoices.findByNumber(token, need(ctx.invoiceNumber, 'When I pay with "..."'));
  expect(invoice.billing_country).toBe(customer.address.country);
});

Then("the form flags that card's invalid field and cannot be submitted", async ({ checkoutPage, ctx }) => {
  const card = need(ctx.invalidCard, 'When I enter the payment details of a "..."');
  await expect(checkoutPage.ui.paymentField(card.field)).toHaveClass(/ng-invalid/);
  await expect(checkoutPage.ui.paymentFieldErrors.first()).toBeVisible();
  await expect(checkoutPage.ui.finish).toBeDisabled();
});

Then('the payment API rejects those details for that field only', async ({ api, ctx }) => {
  const card = need(ctx.invalidCard, 'When I enter the payment details of a "..."');
  const res = await api.payments.checkRequest(card.payment);
  expect(res.status()).toBe(422);
  expect(Object.keys(await api.payments.rejection(res))).toEqual([`payment_details.${card.field}`]);
});

Then('that customer has no invoices', async ({ api, ctx }) => {
  const customer = need(ctx.customer, CUSTOMER);
  const token = await api.auth.login(customer.email, customer.password);
  expect((await api.invoices.list(token)).total).toBe(0);
});
