# Test Strategy – Toolshop (Practice Software Testing)

> Written *before* automation. It records why these tests exist and what was left out on purpose.

## 1. System under test
- **App:** Practice Software Testing "Toolshop", an e-commerce demo (Angular frontend + Laravel REST API)
- **UI:** https://practicesoftwaretesting.com
- **API:** https://api.practicesoftwaretesting.com (Swagger available)
- **Test accounts:** public demo accounts (customer / admin)

## 2. Risk-based prioritisation
| Journey | Business impact | Change frequency | Priority | Layer |
|---|---|---|---|---|
| Login / session | High (blocks everything) | Low | P1 | UI smoke + API |
| Product search & filter | High (revenue entry point) | Medium | P1 | UI + API consistency |
| Add to cart → checkout | Critical (revenue) | Medium | P1 | UI E2E |
| Registration | Medium | Low | P2 | API setup, 1 UI test |
| Admin product management | Medium | Low | P3 | API |
| Contact form, i18n | Low | Low | Out of scope (for now) | – |

## 3. Test pyramid / layer decisions
- **API first:** contracts, validation and negative cases are faster and more stable at API level.
- **UI only for user journeys:** UI tests check what only the browser can show (navigation, state, rendering).
- **Hybrid:** test data is created via API, then verified via UI, which keeps UI tests short and independent.

## 4. Locator strategy
1. `data-test` attributes via `getByTestId` (configured `testIdAttribute: 'data-test'`)
2. Role-based locators (`getByRole`) where no test id exists
3. No CSS/XPath tied to layout

## 5. Test data & isolation
- Every test must be runnable alone and in parallel.
- Logged-in state is created once (`auth.setup.ts`) and reused via `storageState`.
- The public demo is shared and reset periodically, so tests do not depend on exact catalogue counts.
- **Planned:** run the app locally via docker-compose for full data control.

## 6. Execution strategy
| Trigger | Scope | Browsers |
|---|---|---|
| Pull request | `@smoke` (UI + API) | Chromium |
| Nightly | `@regression` full suite, sharded | Chromium, Firefox, WebKit |
| Local (dev) | anything | Chromium (Firefox opt-in via `ALL_BROWSERS=1`) |

**Why Firefox is CI-only by default:** Playwright's bundled Firefox failed to start on the Windows 11 dev machine
(Windows SxS error: dependent assembly `mozglue` not found). It was not a corrupted download (a forced reinstall
did not change it) and not a missing VC++ runtime. Cross-browser coverage is a CI concern anyway, because CI
runs on Linux, which is the reference environment. Keeping the local loop on Chromium keeps it fast and reliable.

## 7. Out of scope (deliberately)
Performance/load testing against the public demo (shared infrastructure), payment provider internals, email delivery.
