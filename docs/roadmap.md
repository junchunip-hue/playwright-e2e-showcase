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
| **S3** ✅ | Admin publishes, customer buys | Admin creates a product via API (A8) → customer finds it by search → buys it → admin ships the order via API → customer sees it listed and SHIPPED | A8, S1 | Cross-role E2E, two sessions in one test |
| **S4** ✅ | Guest checkout (U8) | Anonymous cart → guest tab (email, name) → postcode lookup → pay → `POST /invoices/guest`; the admin finds the order (guest invoices belong to no user) | S1 | Second entry path into the same flow |
| **S5** (optional) | Returning customer | Login → favourites → compare two products → buy one → download the invoice PDF and check its status endpoint | S1 | Downloads, multi-tab/compare UI |
| **S6** ✅ | Resilience | `page.route` delays `/products` (products still appear), makes it fail (blank page, no error: finding) and makes search fail (shown as "no results": finding); each recovers on reload / next search | – | Network mocking, failure UX |
| **S7** (optional) | Languages | Switch language (DE, NL, …) → key pages translated, a11y and visual still pass | a11y, visual | i18n + non-functional checks combined |

**Order:** S2 ✅ → S3 ✅ → A10/A11 ✅ → S6 ✅ → S4 ✅, then optionally S5 and S7 (see [§5](#5-definition-of-done)).
A10/A11 turned the two permission findings from S3 into tracked known defects, S6 shows a technique (mocking) the suite does not use
yet, and S4 is the second entry path into checkout (P1). **Every journey ships in TypeScript and Java**
([ADR 0009](decisions/0009-every-journey-in-both-languages.md)); S1–S3 already do.

Every scenario follows the same contract: **arrange via API, act via UI, assert via UI and API**. Each one gets
its own throwaway data and is tagged `@regression @e2e` (nightly), except the one PR-gate representative per area.

## 3. Structure: refactoring direction (done)

Goal: a reviewer opening the repo for the first time finds a journey, a page object and a CI rule within a
minute, and long scenarios read as business steps rather than clicks.

| # | Change | Result |
|---|---|---|
| **R1** ✅ | Split tests by intent | `tests/api`, `tests/ui` (single pages), `tests/e2e` (journeys), `tests/quality` (a11y, visual), `tests/architecture`; every suite lists the same tests as before |
| **R2** ✅ | **Flows** layer for journeys | `src/flows/CheckoutFlow.ts`; U6 reads arrange/act/assert in 30 lines instead of 71. New scenarios (S2+) add flows such as `admin.publishProduct()` |
| **R3** ✅ | `ApiClient` per resource | `src/api/http.ts` + `resources/{products,auth,customers,addresses,invoices,payments,catalog}.ts` behind one `api` (`api.products.search(...)`) |
| **R4** ✅ | Test-plan ID in every title | `A4: ...`, `U6: ...`; `check:tags` and Java `TagGuardTest` fail on a missing ID or one not in the plan |
| **R5** ✅ | README as a 3-minute tour | Tour, one Mermaid diagram, layout, how to run, "read more" by question |
| **R6** ✅ | Docs by question | `test-strategy.md` (why), `test-plan.md` (what/where), `ci.md` (pipeline), `java.md`, `decisions/` (9 ADRs) |

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

## 5. Definition of done

### A scenario is done when
| # | Criterion | Enforced by |
|---|---|---|
| 1 | It has a row in [test-plan.md](test-plan.md) with its ID, tier and "Java ✅" | `check:tags`, parity test |
| 2 | It exists in TypeScript and Java with the same ID, tier, steps and data | parity test, tier check in `check:tags` |
| 3 | Arrange via API, act via UI, assert via UI and API (journeys) | review |
| 4 | It creates its own data and passes alone and in parallel | review |
| 5 | It passes in the PR gate (if smoke) and in nightly: three browsers and Java | CI |
| 6 | **Three nightly runs in a row without a flaky or failed result** for its ID | nightly summary (checked by hand) |
| 7 | Docs updated: test-plan row, `java.md` table, this roadmap; product defects found go to the test plan's findings | review |

Criterion 6 exists because one green run is not proof: S2 passed for days, then timed out once on WebKit (a test
race with the postcode lookup, fixed in #17).

### The showcase is done when
- **Risks:** every P1/P2 risk in [test-strategy.md](test-strategy.md#2-risk-based-prioritisation) is checked at the
  right layer (met today).
- **Techniques:** each technique the demo should show is used at least once (met 2026-11-18, last three were:)
  - ✅ A10/A11: role-based authorization, and known product defects tracked as tests
    ([ADR 0010](decisions/0010-known-defects-as-tests.md))
  - ✅ S6: network mocking and failure UX
  - ✅ S4: a second entry path into checkout
- **Stability:** five nightly runs in a row with no flaky or failed test in either language. Open: counted from the
  first scheduled nightly after S4 (2026-11-19).
- **Demo:** the README's 3-minute tour can be followed start to finish without other docs (met 2026-11-18: links,
  commands and snippets checked; local-run notes added for `@admin` skips and per-OS visual baselines).

Everything beyond that is optional (S5, S7) or backlog.

### Backlog (not planned)
These would add coverage but no new technique, so they are not part of "done". They stay in the test plan,
marked ➖, and move back only with a reason (a new risk, a defect found nearby).

| ID | Item | Why not now |
|---|---|---|
| A6 | Invoice requires auth (no token → 401) | Same technique as A3 and A10/A11 |
| A7 | Product filters: category, brand, price range, sort | API variant of U3/U4 |
| U8 | Guest checkout | Covered by S4 |
| U9 | Cart: change quantity / remove item | Same layer and pattern as U5 |
| U10 | Registration form validation (UI) | Rules already checked at API level (A4, A5) |
| U11 | Category filter + sort | Same pattern as U3/U4 |
