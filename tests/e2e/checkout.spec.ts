import { createCustomer } from '../../src/data/customers';
import { payments } from '../../src/data/payments';
import { expect, Tag, test } from '../../src/fixtures';

// Journey pattern for every e2e scenario: arrange via API, act via UI (business steps from src/flows),
// assert via UI and API.

test.describe('Checkout', () => {
  // Starts logged out: the customer shops anonymously and signs in during checkout.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('U6: new customer buys an in-stock product with cash on delivery', { tag: [Tag.smoke, Tag.e2e] }, async ({ api, checkout }) => {
    // Arrange (API): a fresh account and a product that can actually be bought.
    const customer = await createCustomer(api);
    const product = await api.products.findInStock();

    // Act (UI): the real user journey.
    await checkout.addToCart(product);
    const cartTotal = await checkout.reviewCart([product]); // discounts applied: the expected invoice amount
    await checkout.signIn(customer);
    await checkout.confirmSavedAddress(customer.address);
    const invoiceNumber = await checkout.pay(payments.cashOnDelivery());

    // Assert (API): the order really exists in the backend, for this customer, at the right price.
    await test.step('invoice exists in the backend', async () => {
      const token = await api.auth.login(customer.email, customer.password);
      const invoice = (await api.invoices.list(token)).data.find((i) => i.invoice_number === invoiceNumber);
      expect(invoice, `invoice ${invoiceNumber} for ${customer.email}`).toBeDefined();
      expect(invoice!.billing_country).toBe(customer.address.country);
      expect(invoice!.total).toBeCloseTo(cartTotal, 2);
    });
  });
});
