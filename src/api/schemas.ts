import { z } from 'zod';

/**
 * Response contracts of the Toolshop API, taken from the pinned upstream source (OpenAPI annotations and model
 * casts) and checked against real responses. ApiClient validates every response against these, so a contract
 * break fails with the exact field path instead of surfacing later as a confusing UI or assertion failure.
 * TypeScript types are derived from the schemas (z.infer), so types and runtime checks cannot drift apart.
 *
 * Objects are not strict: new fields from the API are allowed, missing or retyped ones are not.
 */

// ULIDs are case-insensitive: seeded rows use upper case, rows Laravel creates at runtime (e.g. invoices) lower case.
const ulid = z.string().regex(/^[0-9A-HJKMNP-TV-Z]{26}$/i, 'expected a ULID');

/** Laravel paginator envelope. `from`/`to` are null when a page is empty. */
export const paginated = <T extends z.ZodType>(item: T) =>
  z.object({
    current_page: z.number().int().positive(),
    data: z.array(item),
    from: z.number().int().nullable(),
    to: z.number().int().nullable(),
    last_page: z.number().int().nonnegative(),
    per_page: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  });

export const ProductSchema = z.object({
  id: ulid,
  name: z.string().min(1),
  description: z.string(),
  price: z.number().positive(),
  is_location_offer: z.boolean(),
  is_rental: z.boolean(),
  // A stock count for admins; a boolean for customers and guests, which is how these tests call the API.
  in_stock: z.boolean(),
  co2_rating: z.string(),
  is_eco_friendly: z.boolean(),
  brand: z.object({ id: ulid, name: z.string().min(1) }),
  category: z.object({ id: ulid, name: z.string().min(1), slug: z.string().min(1) }),
  product_image: z.object({
    id: ulid,
    file_name: z.string().min(1),
    title: z.string(),
    by_name: z.string(),
    by_url: z.string(),
    source_name: z.string(),
    source_url: z.string(),
  }),
});

export const ProductPageSchema = paginated(ProductSchema);

/**
 * Known API inconsistency: GET /products/search returns `category` without `slug`, while the list and detail
 * endpoints include it. Modelled explicitly instead of loosening ProductSchema, so the list/detail contract
 * stays strict and a change on either side (search gaining or the list losing `slug`) is reported.
 */
export const ProductSearchItemSchema = ProductSchema.extend({
  category: ProductSchema.shape.category.omit({ slug: true }).strict(),
});

export const ProductSearchPageSchema = paginated(ProductSearchItemSchema);

export const LoginResponseSchema = z.object({
  access_token: z.string().min(1),
  token_type: z.literal('bearer'),
  expires_in: z.number().int().positive(),
});

/** Address as returned by GET /postcode-lookup (the checkout form uses the same endpoint). */
export const PostcodeLookupSchema = z.object({
  street: z.string().min(1),
  house_number: z.string(),
  city: z.string().min(1),
  state: z.string(),
  country: z.string().length(2),
  postcode: z.string().min(1),
});

export const InvoiceSchema = z.object({
  id: ulid,
  invoice_number: z.string().regex(/^INV-\d+$/),
  invoice_date: z.string(),
  billing_street: z.string(),
  billing_city: z.string(),
  billing_state: z.string().nullable(),
  billing_country: z.string(),
  billing_postal_code: z.string().nullable(),
  subtotal: z.number().nullable(),
  total: z.number(),
  status: z.string().min(1),
});

export const InvoicePageSchema = paginated(InvoiceSchema);

/** Rejected request (422 validation, 409 conflict): field name → messages, e.g. { password: ["..."] }. */
export const ValidationErrorsSchema = z.record(z.string(), z.array(z.string().min(1)).min(1));

export type ValidationErrors = z.infer<typeof ValidationErrorsSchema>;

/**
 * Laravel's standard 422 body, used by POST /payment/check: a summary plus field → messages.
 * (Registration answers with the bare field map instead; see ValidationErrorsSchema.)
 */
export const LaravelValidationErrorSchema = z.object({
  message: z.string().min(1),
  errors: ValidationErrorsSchema,
});

export const PaymentCheckSchema = z.object({ message: z.literal('Payment was successful') });
export type Product = z.infer<typeof ProductSchema>;
export type ProductPage = z.infer<typeof ProductPageSchema>;
export type ProductSearchPage = z.infer<typeof ProductSearchPageSchema>;
export type Invoice = z.infer<typeof InvoiceSchema>;
export type InvoicePage = z.infer<typeof InvoicePageSchema>;
