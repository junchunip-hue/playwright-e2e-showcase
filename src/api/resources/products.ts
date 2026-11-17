import type { Http } from '../http';
import {
  CreatedProductSchema,
  ProductPageSchema,
  ProductSchema,
  ProductSearchPageSchema,
  type Product,
  type ProductPage,
  type ProductSearchPage,
} from '../schemas';

/** Request body of POST /products (pinned StoreProduct rules, plus `stock` so the product can be bought). */
export interface NewProduct {
  name: string;
  description: string;
  price: number;
  category_id: string;
  brand_id: string;
  product_image_id: string;
  is_location_offer: boolean;
  is_rental: boolean;
  stock: number;
}

/** GET /products, /products/{id}, /products/search; POST /products */
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
  /** POST /products (an admin action in the UI; the pinned API itself does not check the role). */
  async create(token: string, product: NewProduct): Promise<{ id: string; name: string; price: number }> {
    const res = await this.http.post('/products', product, token);
    return this.http.parse(res, 'POST /products', CreatedProductSchema);
  }

  async findInStock(): Promise<Product> {
    const product = (await this.list()).data.find((p) => p.in_stock && !p.is_rental);
    if (!product) throw new Error('No in-stock product found on page 1 of /products');
    return product;
  }
}
