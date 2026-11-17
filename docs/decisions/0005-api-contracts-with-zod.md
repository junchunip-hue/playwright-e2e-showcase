# 0005 – Every API response is validated against a zod schema

**Status:** Accepted

**Context:** The client's response types were hand-written interfaces that could drift from the real API unnoticed,
and API tests only spot-checked a few fields.

**Decision:** `src/api/schemas.ts` defines the response contracts (products, search, login, postcode lookup,
invoices, validation errors), taken from the pinned Toolshop source (OpenAPI annotations, model casts) and checked
against real responses. `src/api/http.ts` validates every JSON body and reports the field path and the received
value. TypeScript types are `z.infer` of the same schemas. Objects allow new fields; missing or retyped fields fail.

**Consequences:**
- Every test that calls the API also checks the contract; `tests/api/contracts.api.spec.ts` (A0) covers what a
  schema cannot (list/detail/search agreement, empty paginator, the guard itself).
- Findings recorded rather than hidden: `GET /products/search` omits `category.slug` (modelled as
  `ProductSearchItemSchema`, so either side changing is reported); IDs are ULIDs in upper case for seeded rows and
  lower case for rows created at runtime (both accepted, as the format allows).
- Registration rejects with 422 for invalid input and **409** for a duplicate email (A4, A5).
- **Contracts built from seeded data can be too strict.** Every seeded product has a `co2_rating`, but the field is
  optional on create, so the first product published by a test (A8/S3) came back with `null`. That failed the
  contract in all three browser shards and in Java at once. The source confirms `null` is legitimate (not in the
  create rules; the model handles `co2_rating ?? ''`), so the field is nullable in both `schemas.ts` and
  `Contracts.java`. The test data keeps omitting it, so the null case stays covered.
