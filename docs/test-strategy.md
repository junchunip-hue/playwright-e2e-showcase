# Test Strategy – Toolshop (Practice Software Testing)

> **Why** the tests are built this way. What runs where: [test-plan.md](test-plan.md). How CI works: [ci.md](ci.md).
> Individual decisions with their context: [decisions/](decisions/).

## 1. System under test
- **App:** Practice Software Testing "Toolshop", an e-commerce demo (Angular frontend + Laravel REST API)
- **UI:** https://practicesoftwaretesting.com · **API:** https://api.practicesoftwaretesting.com (Swagger available)
- **CI** runs its own Toolshop instance, pinned and freshly seeded ([ADR 0001](decisions/0001-ci-runs-its-own-toolshop.md)).
  Local runs can target the public demo.

## 2. Risk-based prioritisation
| Journey | Business impact | Change frequency | Priority | Layer | Covered by |
|---|---|---|---|---|---|
| Login / session | High (blocks everything) | Low | P1 | UI smoke + API | U1, U2, A2, A3 |
| Product search & filter | High (revenue entry point) | Medium | P1 | UI + API consistency | U3, U4, A1 |
| Add to cart → checkout | Critical (revenue) | Medium | P1 | E2E journey | U5, U6/S1, S2, S4, S6, A9 |
| Who may change products and orders | High (integrity) | Low | P1 | API negatives | A10, A11 (known defects) |
| Registration | Medium | Low | P2 | API rules, data setup | A4, A5 |
| Admin product management → customer purchase | Medium | Low | P2 | API + journey (own Toolshop only) | A8, S3 |
| Contact form, i18n | Low | Low | Later | – | S7 (optional) |

Every API response is also contract-checked (A0); rendering and accessibility are N1 and N2.

## 3. Layers
- **API first:** contracts, validation and negative cases are faster and more stable at API level
  (`tests/api`). Every response is schema-checked ([ADR 0005](decisions/0005-api-contracts-with-zod.md)).
- **UI for what only a browser shows:** navigation, state and rendering (`tests/ui`, single pages).
- **Journeys** (`tests/e2e`) follow one pattern: **arrange via API, act via UI, assert via UI and API**. They are
  written with business steps from `src/flows` (e.g. `checkout.pay('cash-on-delivery')`). Page objects in
  `src/pages` hold locators only.
- **Quality checks** (`tests/quality`): accessibility ([ADR 0003](decisions/0003-accessibility-known-issues.md)) and
  visual regression ([ADR 0004](decisions/0004-visual-baselines-from-ci.md)) run on Chromium.
- **The framework checks itself** (`tests/architecture`): see [ADR 0008](decisions/0008-architecture-tests.md).

## 4. Locator strategy
1. `data-test` attributes via `getByTestId` (configured `testIdAttribute: 'data-test'`)
2. Role-based locators (`getByRole`) where no test id exists
3. No CSS/XPath tied to layout; the few exceptions (e.g. `nav.navbar`) live in page objects with a comment

## 5. Test data & isolation
- Every test must be runnable alone and in parallel.
- Each test that needs an account registers its own customer through the API (`src/data/customers.ts`).
  The shared demo account is used only for successful logins
  ([ADR 0007](decisions/0007-throwaway-accounts-for-negative-logins.md)).
- Logged-in state for single-page UI tests is created once (`tests/auth.setup.ts`) and reused via `storageState`.
- The public demo is shared: catalogue counts change, and other users' data appears (e.g. new brands in the
  filter list). Tests do not depend on exact counts, and local visual baselines are personal for that reason.

## 6. Tags, suites and IDs
Every test has one tier (`@smoke` for the PR gate, `@regression` nightly) and a test-plan ID in its title (`U6: ...`).
Suites are selected by name (`SUITE=pr`), and a tag check keeps both honest
([ADR 0006](decisions/0006-tag-registry-and-test-ids.md), details in [ci.md](ci.md#tags-and-suites)).

## 7. Two languages
TypeScript is the primary suite. Every scenario (A, U, S) also exists in Java + JUnit 5 with the same ID and tier, so
each pipeline runs a TypeScript lane and a Java lane over the same scenarios; only the quality and architecture checks
(N1–N3) are TypeScript-only ([ADR 0002](decisions/0002-typescript-primary-java-twin.md),
[ADR 0009](decisions/0009-every-journey-in-both-languages.md), [java.md](java.md)).

## 8. Out of scope (deliberately)
Performance/load testing against the public demo (shared infrastructure), payment provider internals, email delivery,
a BDD/Gherkin layer (no business author to write it), and accessibility or visual checks on more than one browser.
