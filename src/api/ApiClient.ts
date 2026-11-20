import type { APIRequestContext, APIResponse } from '@playwright/test';

import { Http } from './http';
import { AddressesApi } from './resources/addresses';
import { AuthApi } from './resources/auth';
import { CatalogApi } from './resources/catalog';
import { CustomersApi } from './resources/customers';
import { FavoritesApi } from './resources/favorites';
import { InvoicesApi } from './resources/invoices';
import { PaymentsApi } from './resources/payments';
import { ProductsApi } from './resources/products';
import type { ValidationErrors } from './schemas';

export type { Address } from './resources/addresses';
export type { NewCustomer } from './resources/customers';
export type { NewProduct, ProductFilter } from './resources/products';
export type { Invoice, InvoicePage, Product, ProductPage, ProductSearchPage } from './schemas';

/**
 * The Toolshop REST API as one object, grouped by resource: `api.products.search('pliers')`,
 * `api.auth.login(...)`. Used for API tests and for fast test-data setup in UI tests.
 * Every response is validated against its schema (see ./http and ./schemas).
 * The request context is created with baseURL = API_URL (see src/fixtures).
 */
export class ApiClient {
  readonly products: ProductsApi;
  readonly auth: AuthApi;
  readonly customers: CustomersApi;
  readonly addresses: AddressesApi;
  readonly invoices: InvoicesApi;
  readonly payments: PaymentsApi;
  readonly catalog: CatalogApi;
  readonly favorites: FavoritesApi;
  private readonly http: Http;

  constructor(request: APIRequestContext) {
    this.http = new Http(request);
    this.products = new ProductsApi(this.http);
    this.auth = new AuthApi(this.http);
    this.customers = new CustomersApi(this.http);
    this.addresses = new AddressesApi(this.http);
    this.invoices = new InvoicesApi(this.http);
    this.payments = new PaymentsApi(this.http);
    this.catalog = new CatalogApi(this.http);
    this.favorites = new FavoritesApi(this.http);
  }

  /** Field errors of a rejected request (422 validation, 409 conflict), validated against their schema. */
  validationErrors(res: APIResponse, label: string): Promise<ValidationErrors> {
    return this.http.validationErrors(res, label);
  }
}
