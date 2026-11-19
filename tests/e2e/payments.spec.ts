import type { NewCustomer } from '../../src/api/ApiClient';
import { createCustomer } from '../../src/data/customers';
import { invalidCards, payments } from '../../src/data/payments';
import { expect, Tag, test } from '../../src/fixtures';

// S2: the checkout journey (U6) data-driven over every other payment method, plus invalid cards.
// Arrange via API, act via UI (src/flows), assert via UI and API. Cash on delivery is U6 itself.

const methods = [payments.bankTransfer(), payments.creditCard(), payments.buyNowPayLater(), payments.giftCard()];

test.describe('Payment methods', { tag: [Tag.regression, Tag.e2e] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  for (const payment of methods) {
    test(`S2: new customer pays with ${payment.method}`, async ({ api, checkout }) => {
      const customer = await createCustomer(api);
      const product = await api.products.findInStock();

      await checkout.addToCart(product);
      const cartTotal = await checkout.reviewCart([product]);
      await checkout.signIn(customer);
      await checkout.confirmSavedAddress(customer.address);
      const invoiceNumber = await checkout.pay(payment);

      await test.step('invoice exists in the backend', async () => {
        const invoices = await invoicesOf(api, customer);
        const invoice = invoices.data.find((i) => i.invoice_number === invoiceNumber);
        expect(invoice, `invoice ${invoiceNumber} for ${customer.email}`).toBeDefined();
        expect(invoice!.total).toBeCloseTo(cartTotal, 2);
      });
    });
  }

  for (const card of invalidCards) {
    test(`S2: ${card.name} is blocked before payment and creates no invoice`, { tag: [Tag.negative] }, async ({ api, checkout, checkoutPage }) => {
      const customer = await createCustomer(api);
      const product = await api.products.findInStock();

      await checkout.addToCart(product);
      await checkout.reviewCart([product]);
      await checkout.signIn(customer);
      await checkout.confirmSavedAddress(customer.address);
      await checkout.enterPayment(card.payment);

      await test.step('the form flags the field and cannot be submitted', async () => {
        await expect(checkoutPage.paymentField(card.field)).toHaveClass(/ng-invalid/);
        await expect(checkoutPage.paymentFieldErrors.first()).toBeVisible();
        await expect(checkoutPage.finish).toBeDisabled();
      });

      await test.step('the API would reject it too, and nothing was ordered', async () => {
        const res = await api.payments.checkRequest(card.payment);
        expect(res.status()).toBe(422);
        expect(Object.keys(await api.payments.rejection(res))).toEqual([`payment_details.${card.field}`]);
        expect((await invoicesOf(api, customer)).total).toBe(0);
      });
    });
  }
});

async function invoicesOf(api: Parameters<typeof createCustomer>[0], customer: NewCustomer) {
  return api.invoices.list(await api.auth.login(customer.email, customer.password));
}
