# Test Plan – inventory, order, environments

> Companion to [`test-strategy.md`](test-strategy.md). The strategy explains *why*; this file lists *what* runs,
> *in which order*, *where*, and what is still to be built.

## 1. Environments

| Environment | Where | System under test | Browsers | Used for |
|---|---|---|---|---|
| **Local dev** | Developer machine (Windows 11) | Public demo `practicesoftwaretesting.com` (or local Docker via `.env`) | Chromium (Firefox opt-in `ALL_BROWSERS=1`) | Writing and debugging tests |
| **CI – PR / main** | GitHub Actions, `ubuntu-latest` | Toolshop in Docker, pinned upstream commit, DB seeded per run (`localhost:4200` / `:8091`) | Chromium | Gate every PR and push: `@smoke` |
| **CI – Nightly** *(planned, week 4)* | GitHub Actions, scheduled | Same Docker setup | Chromium, Firefox, WebKit | Full `@regression`, sharded, report on GitHub Pages |

Why CI never uses the public demo: Cloudflare serves a bot challenge to CI runner IPs (see strategy §5).

## 2. Pipeline order (one CI run)

| # | Stage | Checks | Fails fast because |
|---|---|---|---|
| 1 | Static | ESLint (incl. Playwright rules), `tsc --noEmit` | Broken code never reaches a browser |
| 2 | Environment | Containers up, DB seeded, `/products` and UI return 200 | Infra problems are reported as infra, not as test failures |
| 3 | `setup` + `api` (parallel) | Session for UI tests; API contract checks | Cheapest layer first |
| 4 | `chromium` | UI smoke incl. checkout E2E (depends on `setup`) | Only runs when login works |
| 5 | Report | HTML report + trace/video on failure, uploaded as artifact | Every failure is debuggable without re-running |

## 3. Test inventory

Status: ✅ done · 🟡 next · ⬜ planned

### API (`tests/api`, project `api`, no browser)
| ID | Test | Tag | Status |
|---|---|---|---|
| A1 | `GET /products` is paginated and well-formed | `@smoke` | ✅ |
| A2 | Valid credentials return a token | `@smoke` | ✅ |
| A3 | Wrong password → 401 | `@negative` | ✅ |
| A4 | Register: weak / compromised password → 422 with field errors | `@negative` | 🟡 |
| A5 | Register: duplicate email → 422 | `@negative` | 🟡 |
| A6 | Invoice requires auth (no token → 401) | `@negative` | ⬜ |
| A7 | Product filters: category, brand, price range, sort | `@regression` | ⬜ |
| A8 | Admin: product create/update/delete (admin token) | `@regression` | ⬜ |

### UI (`tests/ui`, project `chromium`; Firefox/WebKit nightly)
| ID | Test | Tag | Status |
|---|---|---|---|
| U1 | Login with valid credentials | `@smoke` | ✅ |
| U2 | Login error for wrong password | `@smoke @negative` | ✅ |
| U3 | Search: every result matches the term | `@smoke` | ✅ |
| U4 | Search: UI results equal search API results | `@regression` | ✅ |
| U5 | Add to cart updates the badge (product picked via API) | `@smoke` | ✅ |
| **U6** | **Checkout E2E: API-registered customer → cart → sign in → address (postcode lookup) → cash on delivery → invoice verified via API** | `@smoke @e2e` | ✅ |
| U7 | Checkout with each payment method (data-driven, incl. invalid card) | `@regression` | 🟡 |
| U8 | Guest checkout | `@regression` | ⬜ |
| U9 | Cart: change quantity / remove item, totals update | `@regression` | ⬜ |
| U10 | Registration form validation (UI) | `@regression` | ⬜ |
| U11 | Category filter + sort on the catalogue | `@regression` | ⬜ |

### Non-functional (week 5)
| ID | Test | Where | Status |
|---|---|---|---|
| N1 | Visual regression: home, product, cart (`toHaveScreenshot`, Linux baselines) | Nightly, Chromium | ⬜ |
| N2 | Accessibility: axe-core on key pages, fail on serious/critical | Nightly + PR (Chromium) | ⬜ |

## 4. Which platform checks what

| Check | Local | CI PR/main | CI Nightly |
|---|---|---|---|
| Lint + typecheck | ✅ (`npm run lint`, `npm run typecheck`) | ✅ | ✅ |
| API tests | ✅ | `@smoke` | all |
| UI – Chromium | ✅ | `@smoke` | all |
| UI – Firefox | opt-in | – | all |
| UI – WebKit | – | – | all |
| Checkout E2E | ✅* | ✅ | ✅ (all browsers) |
| Visual regression | – (baselines are Linux) | – | ✅ |
| Accessibility | ✅ | ✅ | ✅ |
| Report | local HTML | artifact (14 days) | GitHub Pages |

\* Locally against the public demo, U6 registers a new demo account per run; prefer a local Docker instance.

## 5. Roadmap

| Step | Scope | Shows |
|---|---|---|
| Week 1 ✅ | Framework, POM, fixtures, smoke suite, PR CI | Structure, conventions |
| Week 3 ✅ (pulled forward) | Toolshop in Docker in CI | Environment isolation, CI debugging |
| Week 2 ✅ | Checkout E2E with API-created customer (U6) | Test data design, hybrid API/UI |
| Next 🟡 | A4, A5, U7 | Negative + data-driven testing |
| Week 4 | Nightly: 3 browsers, sharding, merged blob report on GitHub Pages | CI scalability |
| Week 5 | N1 visual regression, N2 axe-core | Quality beyond functional |
