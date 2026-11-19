import type { APIResponse } from '@playwright/test';
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

/** Query of GET /products (pinned Product::scopeWithFilters and its `between`/`sort` filters). */
export interface ProductFilter {
  /** Category ids (sub-categories match only themselves). */
  byCategory?: string[];
  byBrand?: string[];
  /** Inclusive price range. */
  price?: { min: number; max: number };
  sort?: { by: 'name' | 'price'; order: 'asc' | 'desc' };
  page?: number;
}

/** GET /products, /products/{id}, /products/search; POST /products */
export class ProductsApi {
  constructor(private readonly http: Http) {}

  list(page = 1): Promise<ProductPage> {
    return this.http.get(`/products?page=${page}`, ProductPageSchema);
  }

  /** GET /products with filters and sorting, e.g. `{ byBrand: [id], sort: { by: 'price', order: 'asc' } }`. */
  filter(filter: ProductFilter): Promise<ProductPage> {
    const query = new URLSearchParams();
    if (filter.byCategory) query.set('by_category', filter.byCategory.join(','));
    if (filter.byBrand) query.set('by_brand', filter.byBrand.join(','));
    if (filter.price) query.set('between', `price,${filter.price.min},${filter.price.max}`);
    if (filter.sort) query.set('sort', `${filter.sort.by},${filter.sort.order}`);
    query.set('page', String(filter.page ?? 1));
    return this.http.get(`/products?${query}`, ProductPageSchema);
  }

  get(id: string): Promise<Product> {
    return this.http.get(`/products/${encodeURIComponent(id)}`, ProductSchema);
  }

  search(query: string): Promise<ProductSearchPage> {
    return this.http.get(`/products/search?q=${encodeURIComponent(query)}`, ProductSearchPageSchema);
  }

  /** POST /products (an admin action in the UI; the pinned API itself does not check the role, see A10). */
  async create(token: string, product: NewProduct): Promise<{ id: string; name: string; price: number }> {
    return this.http.parse(await this.createRequest(token, product), 'POST /products', CreatedProductSchema);
  }

  /** POST /products, raw response: for tests that check who may create a product. */
  createRequest(token: string, product: NewProduct): Promise<APIResponse> {
    return this.http.post('/products', product, token);
  }

  /**
   * A purchasable product. Stock changes over time on a shared server, so UI tests ask the API
   * for an in-stock item instead of hard-coding a product name.
   */
  async findInStock(): Promise<Product> {
    return (await this.findInStockProducts(1))[0];
  }

  /** `count` different purchasable products from page 1 (for journeys that compare or buy several). */
  async findInStockProducts(count: number): Promise<Product[]> {
    const products = (await this.list()).data.filter((p) => p.in_stock && !p.is_rental).slice(0, count);
    if (products.length < count) throw new Error(`Fewer than ${count} in-stock products on page 1 of /products`);
    return products;
  }
}
