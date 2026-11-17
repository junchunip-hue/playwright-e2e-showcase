import type { Http } from '../http';
import {
  InvoiceDetailSchema,
  InvoicePageSchema,
  StatusUpdatedSchema,
  type InvoiceDetail,
  type InvoicePage,
  type InvoiceStatus,
} from '../schemas';

/** /invoices: a customer sees their own invoices, an admin sees all of them. */
export class InvoicesApi {
  constructor(private readonly http: Http) {}

  list(token: string): Promise<InvoicePage> {
    return this.http.get('/invoices', InvoicePageSchema, token);
  }

  get(token: string, id: string): Promise<InvoiceDetail> {
    return this.http.get(`/invoices/${encodeURIComponent(id)}`, InvoiceDetailSchema, token);
  }

  /** Search on invoice number, billing street and status. */
  search(token: string, query: string): Promise<InvoicePage> {
    return this.http.get(`/invoices/search?q=${encodeURIComponent(query)}`, InvoicePageSchema, token);
  }

  /** The invoice with this number as `token`'s user sees it; fails with a readable message if there is none. */
  async findByNumber(token: string, invoiceNumber: string): Promise<InvoiceDetail> {
    const match = (await this.search(token, invoiceNumber)).data.find((i) => i.invoice_number === invoiceNumber);
    if (!match) throw new Error(`invoice ${invoiceNumber} not found`);
    return this.get(token, match.id);
  }

  /** PUT /invoices/{id}/status (5-50 character message). */
  async updateStatus(token: string, id: string, status: InvoiceStatus, message: string): Promise<void> {
    const res = await this.http.put(`/invoices/${encodeURIComponent(id)}/status`, { status, status_message: message }, token);
    await this.http.parse(res, `PUT /invoices/${id}/status`, StatusUpdatedSchema);
  }
}
