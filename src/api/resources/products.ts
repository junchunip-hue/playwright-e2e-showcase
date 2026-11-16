import type { Http } from '../http';
import {
  ProductPageSchema,
  ProductSchema,
  ProductSearchPageSchema,
  type Product,
  type ProductPage,
  type ProductSearchPage,
} from '../schemas';

/** GET /products, /products/{id}, /products/search */
export class ProductsApi {
  constructor(private readonly http: Http) {}

  list(page = 1): Promise<ProductPage> {
    return this.http.get(`/products?page=${page}`, ProductPageSchema);
  }

  get(id: string): Promise<Product> {
    return this.http.get(`/products/${encodeURIComponent(id)}`, ProductSchema);
  }

  search(query: string): Promise<ProductSearchPage> {
    return this.http.get(`/products/search?q=${encodeURIComponent(query)}`, ProductSearchPageSchema);
  }

  /**
   * A purchasable product. Stock changes over time on a shared server, so UI tests ask the API
   * for an in-stock item instead of hard-coding a product name.
   */
  async findInStock(): Promise<Product> {
    const product = (await this.list()).data.find((p) => p.in_stock && !p.is_rental);
    if (!product) throw new Error('No in-stock product found on page 1 of /products');
    return product;
  }
}
