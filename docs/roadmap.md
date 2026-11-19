# Roadmap – showcase scenarios and structure

> Companion to [`test-strategy.md`](test-strategy.md) (why) and [`test-plan.md`](test-plan.md) (what runs today).
> This file is how the suite grew into a demo (§1–§4), when it counts as done (§5), and what comes next (§6).

**Status (2026-11-19): three of four showcase criteria met; stability reopened.** Risks, techniques and demo are met
([§5](#5-definition-of-done)). Stability was met on 2026-11-18 and reopened on 2026-11-19 by a flaky S2 (a test race,
fixed in #27); the "clean nightlies" README badge counts the streak after every nightly (4 of 5 on 2026-11-19:
#40, #44, #47, #50). Nothing else is in progress. What comes next is keeping
it green and, only if wanted, the optional or backlog items: see [§6](#6-what-comes-next).

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
| **S1** ✅ | First purchase (exists as U6) | API-registered customer → cart → sign in → postcode lookup → pay → invoice verified via API | – | Hybrid API/UI, isolated data |
| **S2** ✅ | Payment matrix (U7) | Same journey, data-driven over every payment method; invalid card is flagged, cannot be submitted, is rejected by the API (A9) and creates no invoice | S1 | Data-driven tests, negative path, one data model for UI and API |
| **S3** ✅ | Admin publishes, customer buys | Admin creates a product via API (A8) → customer finds it by search → buys it → admin ships the order via API → customer sees it listed and SHIPPED | A8, S1 | Cross-role E2E, two sessions in one test |
| **S4** ✅ | Guest checkout (U8) | Anonymous cart → guest tab (email, name) → postcode lookup → pay → `POST /invoices/guest`; the admin finds the order (guest invoices belong to no user) | S1 | Second entry path into the same flow |
| **S5** ✅ | Returning customer | Sign in → favourite → compare two products → buy the cheaper one, already signed in → download the invoice PDF once the background job has written it; API: favourite, order, PDF status | S1 | File downloads, waiting on background work, comparison UI |
| **S6** ✅ | Resilience | `page.route` delays `/products` (products still appear), makes it fail (blank page, no error: finding) and makes search fail (shown as "no results": finding); each recovers on reload / next search | – | Network mocking, failure UX |
| **S7** (optional) | Languages | Switch language (DE, NL, …) → key pages translated, a11y and visual still pass | a11y, visual | i18n + non-functional checks combined |

**Build order (done):** S2 → S3 → A10/A11 → S6 → S4, then A6, A7 and S5 (2026-11-19). A10/A11 turned the two
permission findings from S3 into tracked known defects, S6 added network mocking, S4 is the second entry path into
checkout (P1), and S5 added file downloads and a wait on Toolshop's background jobs. S7 is optional
([§6](#6-what-comes-next)). **Every journey ships in TypeScript and Java**
([ADR 0009](decisions/0009-every-journey-in-both-languages.md)): S1–S6 do.

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
| **R6** ✅ | Docs by question | `test-strategy.md` (why), `test-plan.md` (what/where), `ci.md` (pipeline), `java.md`, `decisions/` (10 ADRs) |

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
  - jobs without a timeout, unbounded `while`/`until` loops, and browser installs outside the bounded script
- **Parity**: an A/U/S ID that exists in only one language, or a test-plan "Java" column that disagrees with `java/`,
  fails the architecture stage.
- **Known defects** stay visible: A10/A11 pass only while the defect is exactly as today, and each run's summary lists
  them ([ADR 0010](decisions/0010-known-defects-as-tests.md)).
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
| 6 | **Three nightly runs in a row without a flaky or failed result** for its ID | nightly verdict: summary and `test verdict / nightly` commit status ([ci.md](ci.md#pipeline-summary)) |
| 7 | Docs updated: test-plan row, `java.md` table, this roadmap; product defects found go to the test plan's findings | review |

Criterion 6 exists because one green run is not proof. S2 passed for days, then timed out once on WebKit (a test
race with the postcode lookup, fixed in #17). It passed for days again, then failed once on Firefox and passed on the
retry: the test typed the address while the app filled in the saved one (fixed in #27). That flake was the first one
the new flaky list in the pipeline summary caught; before it, a retry would have hidden it.

### The showcase is done when
- **Risks:** every P1/P2 risk in [test-strategy.md](test-strategy.md#2-risk-based-prioritisation) is checked at the
  right layer (met; the risk table names the IDs per risk).
- **Techniques:** each technique the demo should show is used at least once (met 2026-11-18, last three were:)
  - ✅ A10/A11: role-based authorization, and known product defects tracked as tests
    ([ADR 0010](decisions/0010-known-defects-as-tests.md))
  - ✅ S6: network mocking and failure UX
  - ✅ S4: a second entry path into checkout
- **Stability:** five nightly runs in a row with no flaky or failed test in either language (met 2026-11-18: seven
  manual nightlies on `main`, six after S4 and one after the CI hardening in #22, every TypeScript test (94, then
  95) on three browsers and all 34 Java tests green, no flaky, no retries). One of the seven ended red without a failed test: an
  artifact download in `merge-reports` failed, now retried ([ci.md](ci.md#workflows)). Scheduled nightlies keep watching
  this; a flaky or failed test reopens it.
  **Reopened 2026-11-19:** a manual nightly on `main` passed with one flaky test, S2 credit-card on Firefox (run
  44511396786; cause and fix in [test-plan findings](test-plan.md#3-test-inventory), #27). Clean nightlies on `main`
  since the fix: counted by the nightly itself (`scripts/nightly-history.mjs`: `history.json` and the "clean
  nightlies" badge on Pages; 4 of 5 on 2026-11-19). TypeScript and Java both retry twice in CI and report a test that
  passed only on a retry as flaky, so "clean" means no failed, flaky, skipped or not-run test in either language, and
  a verified test list.
- **Demo:** the README's 3-minute tour can be followed start to finish without other docs (met 2026-11-18: links,
  commands and snippets checked; local-run notes added for `@admin` skips and per-OS visual baselines).

Everything beyond that is optional (S7), backlog or a new candidate: see [§6](#6-what-comes-next).

### Backlog (not planned)
These would add coverage but no new technique, so they are not part of "done". They stay in the test plan,
marked ➖, and move back only with a reason (a new risk, a defect found nearby). U7 and U8 are not here: they were
built as S2 and S4. A6 and A7 were here until they were built on 2026-11-19.

| ID | Item | Why not now |
|---|---|---|
| U9 | Cart: change quantity / remove item | Same layer and pattern as U5 |
| U10 | Registration form validation (UI) | Rules already checked at API level (A4, A5) |
| U11 | Category filter + sort | Same pattern as U3/U4 |

## 6. What comes next

Nothing is in progress. Four kinds of work remain, in this order.

### Keep it green (when something happens)
| When | Then | Where |
|---|---|---|
| A scheduled nightly has a flaky or failed test | Fix the cause (test or product), not with a retry; the stability criterion is open again until five clean nightlies follow | nightly summary, [ci.md](ci.md#pipeline-summary) |
| A10 or A11 shows 🟥 "known defect fixed" | Replace `expectKnownDefect` / `KnownDefect` with a plain assertion of the intended status in both languages; move the finding to "fixed" in the test plan | [ADR 0010](decisions/0010-known-defects-as-tests.md) |
| S6 fails because the catalogue or search now shows an error message | Assert the message instead of the blank page / "no results" (the finding is fixed) | [test plan, S6 findings](test-plan.md#3-test-inventory) |
| Toolshop is moved to a newer upstream commit | Change the pin in `.github/actions/toolshop-start`, refresh visual baselines with the `update-snapshots` label, run a manual nightly | [ci.md](ci.md#system-under-test) |
| `@playwright/test` gets a new minor version | Move `playwright.version` in `java/pom.xml` to the same minor | [java.md](java.md#how-the-two-stay-in-sync) |

### Optional scenario (planned, not built)
| ID | Adds | Worth it when |
|---|---|---|
| S7 | i18n combined with accessibility and visual checks (7 languages in the pinned UI) | the demo should show non-English UI or the shop's language switch matters |

### Candidates (not in the plan yet)
Features of the pinned Toolshop that no test touches, and the technique each would add to the demo. None has an ID
yet: one gets the next free ID (A12, S8, N4, …) when it is chosen ([numbering](test-plan.md#how-ids-work)).
Ranked by what they add to a 3-minute demo against what they cost.

| Rank | Candidate | Technique it adds | Layer | Cost, risk |
|---|---|---|---|---|
| 1 | **Admin and customer side by side:** the admin changes an order in the back-office UI while the customer's page shows it | Two browser contexts in one test (two users at once, both in the UI) | S | Medium: admin UI page objects; own Toolshop only |
| 2 | **Two-factor sign-in:** enable TOTP for a fresh customer via API, sign in with a code generated in the test, a wrong or reused code is refused | Time-based secrets in tests (TOTP generator in TS and Java) | A + S | Medium: a TOTP library per language; clock skew handled by the code window |
| 3 | **Keyboard-only checkout:** U6 with Tab, Enter and arrow keys only | Accessibility beyond axe: focus order and operability | N or S | Low to build; may find real defects (a finding is a result, see ADR 0010) |
| 4 | **Live sales feed:** the `/sales-stream` server-sent events and the live activity widget | Asserting a server push (SSE) in API and UI | A + U | Medium: stream parsing in both languages |
| 5 | **Phone-sized checkout:** U6 on a mobile viewport with touch (menu, cart) | Device emulation, responsive layout | S | Low: a Playwright project with a device profile; Java via context options |
| 6 | **Contact form with an attachment:** upload a file, a wrong type or size is refused | File upload (S5 covers download) | A + U | Low |
| 7 | **Account security:** change the password, the old one and old token stop working; repeated failed logins lock the account (423, met by accident on the public demo) | Session invalidation, lock-out rules | A | Low; lock-out only on throwaway accounts (ADR 0007) |

Not candidates: load or performance tests against shared infrastructure, e-mail content (no mail server in the
pinned setup), and more browsers for accessibility or visual checks ([strategy §8](test-strategy.md#8-out-of-scope-deliberately)).

Every new item follows the scenario definition of done ([§5](#5-definition-of-done)): both languages, then three
clean nightlies.

### Backlog
U9–U11 ([§5 backlog](#backlog-not-planned)) add coverage without a new technique. One comes back only with a reason:
a new risk or a defect found nearby.
