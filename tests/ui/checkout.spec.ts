import { expect, test } from '../../src/fixtures';
import { createCustomer } from '../../src/data/customers';

test.describe('Checkout', () => {
  // Starts logged out: the customer shops anonymously and signs in during checkout.
  test.use({ storageState: { cookies: [], origins: [] } });

  test(
    'new customer buys an in-stock product with cash on delivery',
    { tag: ['@smoke', '@e2e'] },
    async ({ api, productPage, header, checkoutPage }) => {
      // Arrange (API): a fresh account and a product that can actually be bought.
      const customer = await createCustomer(api);
      const product = await api.findInStockProduct();

      // Act (UI): the real user journey.
      await test.step('add product to cart', async () => {
        await productPage.goto(product.id);
        await productPage.addToCart.click();
        await expect(header.cartQuantity).toHaveText('1');
      });

      let cartTotal = 0;

      await test.step('cart', async () => {
        await checkoutPage.goto();
        await expect(checkoutPage.productTitles).toHaveText([product.name]);
        // The cart may apply discounts (e.g. eco discount), so the UI total is the expected invoice amount.
        cartTotal = Number((await checkoutPage.cartTotal.textContent())?.replace(/[^0-9.]/g, ''));
        expect(cartTotal).toBeGreaterThan(0);
        await checkoutPage.proceedFromCart.click();
      });

      await test.step('sign in', async () => {
        await checkoutPage.signIn(customer.email, customer.password);
        await expect(checkoutPage.proceedFromSignIn).toBeEnabled();
        await checkoutPage.proceedFromSignIn.click();
      });

      await test.step('billing address via postcode lookup', async () => {
        await checkoutPage.enterAddressForLookup(customer.address);
        await expect(checkoutPage.street).toHaveValue(customer.address.street);
        await expect(checkoutPage.city).toHaveValue(customer.address.city);
        await expect(checkoutPage.state).toHaveValue(customer.address.state);
        await expect(checkoutPage.proceedFromAddress).toBeEnabled();
        await checkoutPage.proceedFromAddress.click();
      });

      let invoiceNumber = '';

      await test.step('pay and confirm', async () => {
        await checkoutPage.paymentMethod.selectOption('cash-on-delivery');
        await checkoutPage.finish.click(); // 1st click: payment check
        await expect(checkoutPage.paymentSuccess).toBeVisible();
        await checkoutPage.finish.click(); // 2nd click: place the order
        await expect(checkoutPage.orderConfirmation).toContainText(/INV-\d+/);
        invoiceNumber = (await checkoutPage.orderConfirmation.textContent())?.match(/INV-\d+/)?.[0] ?? '';
      });

      // Assert (API): the order really exists in the backend, for this customer, at the right price.
      await test.step('invoice exists in the backend', async () => {
        const token = await api.login(customer.email, customer.password);
        const { data: invoices } = await api.getInvoices(token);
        const invoice = invoices.find((i) => i.invoice_number === invoiceNumber);
        expect(invoice, `invoice ${invoiceNumber} for ${customer.email}`).toBeDefined();
        expect(invoice!.billing_country).toBe(customer.address.country);
        expect(Number(invoice!.total)).toBeCloseTo(cartTotal, 2);
      });
    },
  );
});
