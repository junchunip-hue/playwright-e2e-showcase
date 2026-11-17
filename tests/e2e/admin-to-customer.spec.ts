import { createCustomer } from '../../src/data/customers';
import { payments } from '../../src/data/payments';
import { newProductData } from '../../src/data/products';
import { expect, Tag, test } from '../../src/fixtures';

// S3: two roles in one journey. The admin works through the API, the customer through the UI (and checks their
// own orders through their own token). Creates catalogue data, so it runs against our own Toolshop only.

test.describe('Admin to customer', { tag: [Tag.regression, Tag.e2e, Tag.admin] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('S3: admin publishes a product, a customer buys it, the admin ships it', async ({ api, adminToken, homePage, checkout, accountInvoicesPage }) => {
    // 1. Admin (API): publish a new product.
    const published = await api.products.create(adminToken, await newProductData(api));
    const customer = await createCustomer(api);

    // 2. Customer (UI): find it by name, buy it.
    await test.step('customer finds the new product by search', async () => {
      await homePage.goto();
      await homePage.search(published.name);
      await expect(homePage.productNames).toHaveText([published.name]);
    });

    const product = await api.products.get(published.id);
    await checkout.addToCart(product);
    const cartTotal = await checkout.reviewCart([product]);
    await checkout.signIn(customer);
    await checkout.confirmAddress(customer.address);
    const invoiceNumber = await checkout.pay(payments.cashOnDelivery());

    // 3. Admin (API): ship the order.
    const message = 'Shipped by the S3 journey';

    const invoice = await test.step('admin ships the order', async () => {
      const found = await api.invoices.findByNumber(adminToken, invoiceNumber);
      expect(found.total).toBeCloseTo(cartTotal, 2);
      await api.invoices.updateStatus(adminToken, found.id, 'SHIPPED', message);
      return found;
    });

    // 4. Customer: the order is listed in their account, and their own API view shows the new status.
    await test.step('customer sees the order as shipped', async () => {
      await accountInvoicesPage.goto();
      await expect(accountInvoicesPage.row(invoiceNumber)).toBeVisible();

      const token = await api.auth.login(customer.email, customer.password);
      const mine = await api.invoices.get(token, invoice.id);
      expect(mine).toMatchObject({ invoice_number: invoiceNumber, status: 'SHIPPED', status_message: message });
    });
  });
});
