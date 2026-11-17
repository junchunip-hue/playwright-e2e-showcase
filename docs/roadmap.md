# Roadmap – showcase scenarios and structure

> Companion to [`test-strategy.md`](test-strategy.md) (why) and [`test-plan.md`](test-plan.md) (what runs today).
> This file is the plan for growing the suite into a demo: longer, story-like scenarios, and a layout that stays
> readable while it grows. Items marked **proposed** need a review decision before they are built.

## 1. What a demo should show in 3 minutes

| Minute | Show | Where it lives today |
|---|---|---|
| 1 | One business journey that reads like a story, API and UI working together | `tests/e2e/checkout.spec.ts` (U6) |
| 2 | Quality beyond functional: contracts, accessibility, visual, cross-browser | `tests/api/contracts.api.spec.ts`, `tests/quality/a11y.spec.ts`, `tests/quality/visual.spec.ts`, nightly report |
| 3 | A pipeline that guards itself: tag check, architecture tests, Auto-fix-able CI | `src/tags.ts`, `tests/architecture/`, `.github/` |

Everything below either makes one of these three minutes stronger or keeps the repository easy to walk through.

## 2. Showcase scenarios (longer journeys)

Each scenario reuses the existing building blocks (API client + schemas, data builders, page objects, tags).
The IDs continue the test plan: `S` = story, a multi-step journey across roles or layers.

| ID | Scenario | Steps (abridged) | Builds on | Shows |
|---|---|---|---|---|
| **S1** | First purchase (exists as U6) | API-registered customer → cart → sign in → postcode lookup → pay → invoice verified via API | ✅ | Hybrid API/UI, isolated data |
| **S2** ✅ | Payment matrix (U7) | Same journey, data-driven over every payment method; invalid card is flagged, cannot be submitted, is rejected by the API (A9) and creates no invoice | S1 | Data-driven tests, negative path, one data model for UI and API |
| **S3** | Admin publishes, customer buys | Admin creates a product via API (A8) → customer finds it with search + category filter (U11) → buys it → admin sets invoice status → customer sees the new status | A8, U11, S1 | Cross-role E2E, two sessions in one test |
| **S4** | Guest checkout (U8) | Anonymous cart → guest email → address → pay → invoice via guest endpoint | S1 | Second entry path into the same flow |
| **S5** | Returning customer | Login → favourites → compare two products → buy one → download the invoice PDF and check its status endpoint | S1 | Downloads, multi-tab/compare UI |
| **S6** | Resilience | `page.route` makes `/products` fail or slow down → UI shows its error/loading state, recovers on retry | – | Network mocking, failure UX |
| **S7** | Languages | Switch language (DE, NL, …) → key pages translated, a11y and visual still pass | a11y, visual | i18n + non-functional checks combined |

**Order:** S2 ✅ → S3 → S6 → S4 → S5 → S7. S2 extends the flagship directly, S3 is the strongest demo story
(two roles, API + UI), and S6 shows a technique (mocking) the suite does not use yet. **Every journey ships in
TypeScript and Java** ([ADR 0009](decisions/0009-every-journey-in-both-languages.md)); S1 and S2 already do.

Every scenario follows the same contract: **arrange via API, act via UI, assert via UI and API**. Each one gets
its own throwaway data and is tagged `@regression @e2e` (nightly), except the one PR-gate representative per area.

## 3. Structure: refactoring direction (done)

Goal: a reviewer opening the repo for the first time finds a journey, a page object and a CI rule within a
minute, and long scenarios read as business steps rather than clicks.

| # | Change | Result |
|---|---|---|
| **R1** ✅ | Split tests by intent | `tests/api`, `tests/ui` (single pages), `tests/e2e` (journeys), `tests/quality` (a11y, visual), `tests/architecture`; every suite lists the same tests as before |
| **R2** ✅ | **Flows** layer for journeys | `src/flows/CheckoutFlow.ts`; U6 reads arrange/act/assert in 30 lines instead of 71. New scenarios (S2+) add flows such as `admin.publishProduct()` |
| **R3** ✅ | `ApiClient` per resource | `src/api/http.ts` + `resources/{products,auth,customers,addresses,invoices}.ts` behind one `api` (`api.products.search(...)`) |
| **R4** ✅ | Test-plan ID in every title | `A4: ...`, `U6: ...`; `check:tags` and Java `TagGuardTest` fail on a missing ID or one not in the plan |
| **R5** ✅ | README as a 3-minute tour | Tour, one Mermaid diagram, layout, how to run, "read more" by question |
| **R6** ✅ | Docs by question | `test-strategy.md` (why), `test-plan.md` (what/where), `ci.md` (pipeline), `java.md`, `decisions/` (8 ADRs) |

**Not planned:** a BDD/Gherkin layer (adds a translation step without a business author), more browsers for
a11y/visual (no extra signal).

**Conventions for what comes next:** a new journey gets an `S` ID in the test plan and is written twice, with the
same steps and data:
- TypeScript: `tests/e2e`, flows from `src/flows`, builders from `src/data`, API calls on `src/api/resources`
- Java: `java/.../tests`, `flows/`, `data/`, `ApiClient`, with `@RegressionCases`/`@Journey` and the same display name
- Test plan row marked "Java ✅". The parity architecture test fails until both exist.

A new decision gets the next ADR number.

## 4. Guard rails that already keep this manageable

- **Tags and suites** in one registry, checked by `npm run check:tags` (TS) and `TagGuardTest` (Java).
- **Architecture tests** (`tests/architecture/`) fail on pipeline loops and cycles:
  - self-triggering workflows (a workflow that pushes must not be triggered by a push, must use `GITHUB_TOKEN`, and must remove its trigger label)
  - `workflow_run` cycles, workflows that start other workflows
  - composite-action, npm-script, Playwright-project and import cycles
  - jobs without a timeout, and unbounded `while`/`until` loops
- **Contracts**: every API response is schema-validated, so new scenarios get contract coverage for free.
- **Isolation**: each scenario creates its own customers; the shared demo account is only used for successful logins.
