import type { APIRequestContext, APIResponse } from '@playwright/test';

export interface Product {
  id: string;
  name: string;
  price: number;
  in_stock: boolean;
  is_rental: boolean;
}

export interface Paginated<T> {
  current_page: number;
  data: T[];
  total: number;
}

export interface Address {
  street: string;
  house_number: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

export interface NewCustomer {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  dob: string;
  phone: string;
  address: Address;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  billing_country: string;
}

/**
 * Thin typed wrapper around the Toolshop REST API.
 * Used both for API tests and for fast test-data setup in UI tests.
 * The request context is created with baseURL = API_URL (see fixtures).
 */
export class ApiClient {
  constructor(private readonly request: APIRequestContext) {}

  loginRequest(email: string, password: string): Promise<APIResponse> {
    return this.request.post('/users/login', { data: { email, password } });
  }

  async login(email: string, password: string): Promise<string> {
    const res = await this.loginRequest(email, password);
    await this.ensureOk(res, 'POST /users/login');
    const body = (await res.json()) as { access_token: string };
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
    const res = await this.getJson<Omit<Address, 'postal_code'> & { postcode: string }>(`/postcode-lookup?${query}`);
    return {
      street: res.street,
      house_number: res.house_number,
      city: res.city,
      state: res.state,
      country: res.country,
      postal_code: res.postcode,
    };
  }

  async getInvoices(token: string): Promise<Paginated<Invoice>> {
    return this.getJson('/invoices', token);
  }

  async getProducts(page = 1): Promise<Paginated<Product>> {
    return this.getJson(`/products?page=${page}`);
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

  async searchProducts(query: string): Promise<Paginated<Product>> {
    return this.getJson(`/products/search?q=${encodeURIComponent(query)}`);
  }

  private async getJson<T>(path: string, token?: string): Promise<T> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const res = await this.request.get(path, { headers });
    await this.ensureOk(res, `GET ${path}`);
    return (await res.json()) as T;
  }

  private async ensureOk(res: APIResponse, label: string): Promise<void> {
    if (res.ok()) return;
    // Include the start of the body: server errors (e.g. Laravel debug output) are otherwise invisible in CI.
    const body = (await res.text()).slice(0, 500);
    throw new Error(`${label} failed: ${res.status()}\n${body}`);
  }
}
