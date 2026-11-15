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
    if (!res.ok()) throw new Error(`Login failed: ${res.status()} ${await res.text()}`);
    const body = (await res.json()) as { access_token: string };
    return body.access_token;
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

  private async getJson<T>(path: string): Promise<T> {
    const res = await this.request.get(path);
    if (!res.ok()) {
      // Include the start of the body: server errors (e.g. Laravel debug output) are otherwise invisible in CI.
      const body = (await res.text()).slice(0, 500);
      throw new Error(`GET ${path} failed: ${res.status()}\n${body}`);
    }
    return (await res.json()) as T;
  }
}
