import { isPublicDemo } from '../../src/config/env';
import { createCustomer } from '../../src/data/customers';
import { payments } from '../../src/data/payments';
import { expect, Tag, test } from '../../src/fixtures';

// S5: a customer who signs in first and shops around before buying: favourites, a side-by-side comparison, then the
// order and its invoice as a PDF download. The PDF is written by a background job after the order (Toolshop's
// scheduler; CI runs it, see .github/actions/toolshop-ready), so this journey also waits on asynchronous work.

test.describe('Returning customer', () => {
  // Measured 2026-11-19: the public demo starts the PDF job but did not finish it in 4 minutes, then reset its data.
  test.skip(isPublicDemo, 'the public demo does not finish invoice PDFs in time: our own Toolshop only (CI, local Docker)');
  // Starts logged out: the customer signs in on the login page, not in checkout.
  test.use({ storageState: { cookies: [], origins: [] } });

  test('S5: a returning customer saves a favourite, compares two products, buys the cheaper one and downloads the invoice', { tag: [Tag.regression, Tag.e2e] }, async ({ api, shopper, checkout }) => {
    test.setTimeout(240_000); // includes waiting for the background PDF job

    // Arrange (API): a registered customer and two different products that can be bought.
    const customer = await createCustomer(api);
    const [first, second] = await api.products.findInStockProducts(2);

    // Act (UI): sign in, keep one product as a favourite, compare both.
    await shopper.signIn(customer);
    await shopper.addToFavorites(first);
    expect(await shopper.favorites()).toEqual([first.name]);

    const shown = await shopper.compare([first, second]);
    expect(shown, 'the comparison shows the catalogue prices').toEqual(new Map([[first.name, first.price], [second.name, second.price]]));

    // Buy the cheaper of the two, already signed in.
    const [cheaper] = [first, second].sort((a, b) => a.price - b.price);
    await checkout.addToCart(cheaper);
    const cartTotal = await checkout.reviewCart([cheaper]);
    await checkout.continueSignedIn();
    await checkout.confirmAddress(customer.address);
    const invoiceNumber = await checkout.pay(payments.cashOnDelivery());

    // The invoice as a file: named after the order, and a real PDF.
    const pdf = await shopper.downloadInvoice(invoiceNumber);
    expect(pdf.fileName).toBe(`${invoiceNumber}.pdf`);
    expect(pdf.body.subarray(0, 5).toString()).toBe('%PDF-');

    // Assert (API, as the customer): the favourite and the order are stored, the PDF is marked complete.
    await test.step('the backend has the favourite, the order and the PDF', async () => {
      const token = await api.auth.login(customer.email, customer.password);
      expect((await api.favorites.list(token)).map((f) => f.product_id)).toEqual([first.id]);
      expect((await api.invoices.findByNumber(token, invoiceNumber)).total).toBeCloseTo(cartTotal, 2);
      expect(await api.invoices.pdfStatus(token, invoiceNumber)).toBe('COMPLETED');
    });
  });
});
