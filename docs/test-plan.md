# Test Plan – inventory, order, environments

> Companion to [`test-strategy.md`](test-strategy.md). The strategy explains *why*; this file lists *what* runs,
> *in which order*, *where*, and what is still to be built.

## 1. Environments

| Environment | Where | System under test | Browsers | Used for |
|---|---|---|---|---|
| **Local dev** | Developer machine (Windows 11) | Public demo `practicesoftwaretesting.com` (or local Docker via `.env`) | Chromium (Firefox/WebKit opt-in `ALL_BROWSERS=1`) | Writing and debugging tests |
| **CI – PR / main** | GitHub Actions, `ubuntu-latest` | Toolshop in Docker, upstream commit pinned in `.github/actions/toolshop-start`, DB seeded per run (`localhost:4200` / `:8091`) | Chromium | Gate every PR and push: `@smoke`, `@a11y`, `@visual` (TS) + `smoke` (Java) |
| **CI – Nightly** | GitHub Actions, 02:00 UTC + manual | Same Docker setup, one instance per shard | Chromium, Firefox, WebKit | Full suite (TS, 3 shards) + full Java suite; merged report on GitHub Pages |
| **CI – Visual baselines** | GitHub Actions, PR label `update-snapshots` | Same Docker setup | Chromium | Regenerates Linux baselines and commits them to the PR |

Why CI never uses the public demo: Cloudflare serves a bot challenge to CI runner IPs ([ADR 0001](decisions/0001-ci-runs-its-own-toolshop.md)).

## 2. Pipeline order (one PR run, TypeScript job)

| # | Stage | Checks | Fails fast because |
|---|---|---|---|
| 1 | Static | ESLint (incl. Playwright rules), `tsc --noEmit`, tag check, architecture tests | Broken code or a looping pipeline never reaches a browser |
| 2 | Environment | Containers up, DB seeded, `/products` and UI return 200 | Infra problems are reported as infra, not as test failures |
| 3 | `setup` + `api` (parallel) | Session for UI tests; API contract checks | Cheapest layer first |
| 4 | `chromium` | UI smoke incl. checkout E2E, accessibility, visual (depends on `setup`) | Only runs when login works |
| 5 | Report | HTML report + trace/video on failure, uploaded as artifact | Every failure is debuggable without re-running |

The Java job runs the same stages 2–5 in parallel with JUnit 5 (`./mvnw test -Dgroups=smoke`).

## 3. Test inventory

Status: ✅ done · 🟡 next · ⬜ planned. **Java** marks scenarios mirrored in `java/` (JUnit 5).

### API (`tests/api`, project `api`, no browser)
| ID | Test | Tag | Java | Status |
|---|---|---|---|---|
| A1 | `GET /products` is paginated and well-formed | `@smoke` | ✅ | ✅ |
| A2 | Valid credentials return a token | `@smoke` | ✅ | ✅ |
| A3 | Wrong password → 401 | `@regression @negative` | ✅ | ✅ |
| A0 | Response contracts: every response validated against `src/api/schemas.ts` (zod); explicit checks for list/detail/search, empty paginator, login + invoices, postcode lookup, and the guard itself | `@smoke` | ✅ | ✅ |
| A4 | Register: weak password → 422 listing every unmet rule | `@smoke @negative` | ✅ | ✅ |
| A4 | Register: password from a data leak → 422 (external HIBP check, so nightly) | `@regression @negative` | ✅ | ✅ |
| A5 | Register: duplicate email → **409** Conflict (not 422 as first assumed) | `@smoke @negative` | ✅ | ✅ |
| A9 | Payment check: every method with valid details → 200; invalid card → 422 naming only the broken field | `@smoke @negative` | ✅ | ✅ |
| A6 | Invoice requires auth (no token → 401) | `@negative` | | ⬜ |
| A7 | Product filters: category, brand, price range, sort | `@regression` | | ⬜ |
| A8 | Admin publishes a product: listed with its brand/category, searchable, in stock (own Toolshop only) | `@smoke @admin` | ✅ | ✅ |

### UI and journeys (`tests/ui`, `tests/e2e`, project `chromium`; Firefox/WebKit nightly)
| ID | Test | Tag | Java | Status |
|---|---|---|---|---|
| U1 | Login with valid credentials | `@smoke` | ✅ | ✅ |
| U2 | Login error for wrong password | `@smoke @negative` | ✅ | ✅ |
| U3 | Search: every result matches the term | `@smoke` | ✅ | ✅ |
| U4 | Search: UI results equal search API results | `@regression` | ✅ | ✅ |
| U5 | Add to cart updates the badge (product picked via API) | `@smoke` | ✅ | ✅ |
| **U6** | **Checkout E2E: API-registered customer → cart → sign in → address (postcode lookup) → cash on delivery → invoice verified via API** | `@smoke @e2e` | ✅ | ✅ |
| U7 | Checkout with each payment method → implemented as journey **S2** below | – | | ✅ |
| U8 | Guest checkout | `@regression` | | ⬜ |
| U9 | Cart: change quantity / remove item, totals update | `@regression` | | ⬜ |
| U10 | Registration form validation (UI) | `@regression` | | ⬜ |
| U11 | Category filter + sort on the catalogue | `@regression` | | ⬜ |

### Journeys (`tests/e2e`, see [roadmap.md](roadmap.md) §2)
| ID | Journey | Tag | Java | Status |
|---|---|---|---|---|
| S1 | First purchase (= U6) | `@smoke @e2e` | = U6 | ✅ |
| S2 | Payment matrix: bank transfer, credit card, buy now pay later, gift card each end in an invoice at the cart total; a malformed or expired card is flagged in the form, cannot be submitted, is rejected by the API too, and creates no invoice | `@regression @e2e` | ✅ | ✅ |
| S3 | Admin publishes a product (API), customer finds and buys it (UI), admin ships it (API), customer sees it listed and SHIPPED (own Toolshop only) | `@regression @e2e @admin` | ✅ | ✅ |

**Findings while building S3 (pinned source, not asserted yet):** `POST /products` does not check the admin role
(`StoreProduct::authorize()` returns true; only delete requires admin), and `PUT /invoices/{id}/status` only requires a
signed-in user. S3 tests the intended flow (an admin acts). Candidate negative tests: a customer creating a product
or changing an invoice status should be rejected.

### Non-functional (`tests/quality`, `tests/architecture`; Chromium only)
| ID | Test | Where | Status |
|---|---|---|---|
| N1 | Visual regression: header, login form, contact form, catalogue filters, full login page (masked) | PR + nightly | ✅ |
| N2 | Accessibility: axe-core WCAG 2.1 A/AA on 6 pages, known-issue baseline ([ADR 0003](decisions/0003-accessibility-known-issues.md)) | PR + nightly | ✅ |
| N3 | Architecture: no self-triggering workflows, no cycles (actions, workflow_run, npm scripts, projects, imports), every job bounded | PR static stage | ✅ |

`tests/ui/seed.spec.ts` (`@seed`) is the starting state for Playwright Test Agents, not a test case: no suite
selects it.

Tags and suites are defined in `src/tags.ts` (Java: `com.showcase.annotations`); see [ci.md](ci.md#tags-and-suites).
Every test has exactly one tier tag, enforced by `npm run check:tags` and the Java `TagGuardTest`.

## 4. Which platform checks what

| Check | Local | CI PR/main | CI Nightly |
|---|---|---|---|
| Lint + typecheck | ✅ (`npm run lint`, `npm run typecheck`) | ✅ | – |
| API tests | ✅ | `@smoke` | all |
| UI – Chromium | ✅ | `@smoke` | all |
| UI – Firefox / WebKit | opt-in | – | all (except `@a11y`, `@visual`) |
| Checkout E2E | ✅* | ✅ | ✅ (all browsers) |
| Accessibility | ✅ (`npm run test:a11y`) | ✅ | ✅ |
| Visual regression | own OS baselines, git-ignored | ✅ (Linux baselines) | ✅ |
| Java suite | ✅ (`./mvnw test`) | `smoke` | all |
| Report | local HTML | artifact (14 days) | GitHub Pages |

\* Locally against the public demo, U6 registers a new demo account per run; prefer a local Docker instance.

## 5. Roadmap

| Step | Scope | Shows |
|---|---|---|
| ✅ | Framework, POM, fixtures, smoke suite, PR CI | Structure, conventions |
| ✅ | Toolshop in Docker in CI | Environment isolation, CI debugging |
| ✅ | Checkout E2E with API-created customer (U6) | Test data design, hybrid API/UI |
| ✅ | Java + JUnit 5 twin suite for the smoke scenarios | Same design in two stacks |
| ✅ | Nightly: 3 browsers, sharding, merged blob report on GitHub Pages | CI scalability |
| ✅ | N1 visual regression, N2 axe-core | Quality beyond functional |
| ✅ | A0 API schema validation (types derived from the schemas) | Contract testing |
| ✅ | Negative login tests on throwaway accounts (the shared demo account locks after repeated failures) | Test data isolation |
| ✅ | A4, A5 registration rules; N3 architecture tests | Negative testing, self-guarding pipeline |
| Next 🟡 | Showcase scenarios S2–S7 and structure R1–R6 | See [`roadmap.md`](roadmap.md) |
