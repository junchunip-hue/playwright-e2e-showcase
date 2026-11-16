import type { APIRequestContext, APIResponse } from '@playwright/test';
import { z } from 'zod';
import {
  InvoicePageSchema,
  LoginResponseSchema,
  PostcodeLookupSchema,
  ProductPageSchema,
  ProductSchema,
  ProductSearchPageSchema,
  type InvoicePage,
  type Product,
  type ProductPage,
  type ProductSearchPage,
} from './schemas';

export type { Invoice, InvoicePage, Product, ProductPage, ProductSearchPage } from './schemas';

/** Address as our test data and the checkout form use it (the lookup endpoint calls the postcode `postcode`). */
export interface Address {
  street: string;
  house_number: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

/** Request body of POST /users/register (our own test data, so a plain type rather than a response schema). */
export interface NewCustomer {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  dob: string;
  phone: string;
  address: Address;
}

/**
 * Thin typed wrapper around the Toolshop REST API.
 * Used both for API tests and for fast test-data setup in UI tests.
 * Every JSON response is validated against its schema in ./schemas, so any test that touches the API
 * also checks the contract. The request context is created with baseURL = API_URL (see fixtures).
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  loginRequest(email: string, password: string): Promise<APIResponse> {
    return this.request.post('/users/login', { data: { email, password } });
  }

  async login(email: string, password: string): Promise<string> {
    const res = await this.loginRequest(email, password);
    const body = await this.parse(res, 'POST /users/login', LoginResponseSchema);
    return body.access_token;
  }

  async registerCustomer(customer: NewCustomer): Promise<void> {
    const res = await this.request.post('/users/register', { data: customer });
    await this.ensureOk(res, 'POST /users/register');
  }

  /**
   * The postcode lookup the checkout form uses. Toolshop validates at checkout that city/state belong to
   * the postcode, so test addresses are taken from this endpoint instead of being invented.
   */
  async lookupAddress(country: string, postcode: string, houseNumber: string): Promise<Address> {
    const query = new URLSearchParams({ country, postcode, house_number: houseNumber });
    const { postcode: postalCode, ...rest } = await this.getJson(`/postcode-lookup?${query}`, PostcodeLookupSchema);
    return { ...rest, postal_code: postalCode };
  }

  async getInvoices(token: string): Promise<InvoicePage> {
    return this.getJson('/invoices', InvoicePageSchema, token);
  }

  async getProducts(page = 1): Promise<ProductPage> {
    return this.getJson(`/products?page=${page}`, ProductPageSchema);
  }

  async getProduct(id: string): Promise<Product> {
    return this.getJson(`/products/${encodeURIComponent(id)}`, ProductSchema);
  }

  /**
   * Returns a purchasable product. The shared demo server's stock changes over time,
   * so UI tests ask the API for an in-stock item instead of hard-coding a product name.
   */
  async findInStockProduct(): Promise<Product> {
    const { data } = await this.getProducts();
    const product = data.find((p) => p.in_stock && !p.is_rental);
    if (!product) throw new Error('No in-stock product found on page 1 of /products');
    return product;
  }

  async searchProducts(query: string): Promise<ProductSearchPage> {
    return this.getJson(`/products/search?q=${encodeURIComponent(query)}`, ProductSearchPageSchema);
  }

  private async getJson<S extends z.ZodType>(path: string, schema: S, token?: string): Promise<z.infer<S>> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return this.parse(await this.request.get(path, { headers }), `GET ${path}`, schema);
  }

  /** Fails on a non-2xx status first, then on a body that breaks the contract (with the offending field paths). */
  private async parse<S extends z.ZodType>(res: APIResponse, label: string, schema: S): Promise<z.infer<S>> {
    await this.ensureOk(res, label);
    const body: unknown = await res.json();
    const result = schema.safeParse(body);
    if (!result.success) {
      const received = result.error.issues
        .map((i) => `  ${i.path.join('.') || '(root)'} = ${JSON.stringify(valueAt(body, i.path))?.slice(0, 120)}`)
        .join('\n');
      throw new Error(
        `${label} response does not match its schema:\n${z.prettifyError(result.error)}\nReceived:\n${received}`,
      );
    }
    return result.data;
  }

  private async ensureOk(res: APIResponse, label: string): Promise<void> {
    if (res.ok()) return;
    // Include the start of the body: server errors (e.g. Laravel debug output) are otherwise invisible in CI.
    const body = (await res.text()).slice(0, 500);
    throw new Error(`${label} failed: ${res.status()}\n${body}`);
  }
}

function valueAt(value: unknown, path: readonly PropertyKey[]): unknown {
  return path.reduce<unknown>((v, key) => (v as Record<PropertyKey, unknown> | undefined)?.[key], value);
}
