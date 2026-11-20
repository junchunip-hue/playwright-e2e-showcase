import type { APIResponse } from '@playwright/test';

import type { Http } from '../http';
import {
  type InvoiceDetail,
  InvoiceDetailSchema,
  type InvoicePage,
  InvoicePageSchema,
  type InvoiceStatus,
  type PdfStatus,
  PdfStatusSchema,
  StatusUpdatedSchema,
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

  /**
   * GET /invoices/{number}/download-pdf-status. 400 with NOT_INITIATED is an answer, not an error: the background
   * job has not picked the invoice up yet.
   */
  async pdfStatus(token: string, invoiceNumber: string): Promise<PdfStatus> {
    const label = `GET /invoices/${invoiceNumber}/download-pdf-status`;
    const res = await this.pdfStatusRequest(invoiceNumber, token);
    if (res.status() !== 400) await this.http.ensureOk(res, label);
    return (await this.http.body(res, label, PdfStatusSchema)).status;
  }

  // Raw responses (any status), for A6: who may read invoices. Without a token the request is anonymous.
  listRequest(token?: string): Promise<APIResponse> {
    return this.http.getRaw('/invoices', token);
  }

  getRequest(id: string, token?: string): Promise<APIResponse> {
    return this.http.getRaw(`/invoices/${encodeURIComponent(id)}`, token);
  }

  pdfRequest(invoiceNumber: string, token?: string): Promise<APIResponse> {
    return this.http.getRaw(`/invoices/${encodeURIComponent(invoiceNumber)}/download-pdf`, token);
  }

  pdfStatusRequest(invoiceNumber: string, token?: string): Promise<APIResponse> {
    return this.http.getRaw(`/invoices/${encodeURIComponent(invoiceNumber)}/download-pdf-status`, token);
  }

  /** PUT /invoices/{id}/status (5-50 character message). */
  async updateStatus(token: string, id: string, status: InvoiceStatus, message: string): Promise<void> {
    const res = await this.updateStatusRequest(token, id, status, message);
    await this.http.parse(res, `PUT /invoices/${id}/status`, StatusUpdatedSchema);
  }

  /** PUT /invoices/{id}/status, raw response: for tests that check who may change it. The message is optional. */
  updateStatusRequest(token: string, id: string, status: InvoiceStatus, message?: string): Promise<APIResponse> {
    const body = message === undefined ? { status } : { status, status_message: message };
    return this.http.put(`/invoices/${encodeURIComponent(id)}/status`, body, token);
  }
}
