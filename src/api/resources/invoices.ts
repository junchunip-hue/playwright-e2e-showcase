import type { Http } from '../http';
import { InvoicePageSchema, type InvoicePage } from '../schemas';

/** GET /invoices (the customer's own invoices) */
export class InvoicesApi {
  constructor(private readonly http: Http) {}

  list(token: string): Promise<InvoicePage> {
    return this.http.get('/invoices', InvoicePageSchema, token);
  }
}
