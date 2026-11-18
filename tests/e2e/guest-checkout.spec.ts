import { newCustomerData } from '../../src/data/customers';
import { payments } from '../../src/data/payments';
import { expect, Tag, test } from '../../src/fixtures';

// S4: the second way into checkout. A guest never registers: the guest tab takes email and name, the postcode lookup
// fills the address (nothing is prefilled for guests), and the order goes to POST /invoices/guest. A guest invoice
// belongs to no user, so only the admin can look it up afterwards: own Toolshop only (adminToken).

test.describe('Guest checkout', () => {
  // Starts logged out, like a first-time visitor.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('S4: a guest buys without an account and the order exists at the cart total', { tag: [Tag.regression, Tag.e2e, Tag.admin] }, async ({ api, checkout, adminToken }) => {
    // Arrange (API): guest details (never registered) and a product that can actually be bought.
    const guest = await newCustomerData(api);
    const product = await api.products.findInStock();

    // Act (UI): same flow as U6, but "continue as guest" instead of signing in.
    await checkout.addToCart(product);
    const cartTotal = await checkout.reviewCart([product]);
    await checkout.continueAsGuest(guest);
    await checkout.confirmAddress(guest.address);
    const invoiceNumber = await checkout.pay(payments.cashOnDelivery());

    // Assert (API, as admin): the order exists, at the cart total, with the guest's billing address.
    await test.step('the guest order exists in the backend', async () => {
      const invoice = await api.invoices.findByNumber(adminToken, invoiceNumber);
      expect(invoice.total).toBeCloseTo(cartTotal, 2);
      expect(invoice).toMatchObject({
        billing_street: guest.address.street,
        billing_city: guest.address.city,
        billing_country: guest.address.country,
      });
    });
  });
});
