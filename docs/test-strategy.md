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
- **CI runs against its own Toolshop instance** (Docker, upstream repo pinned to a commit, DB migrated and seeded
  on every run). Local development can still target the public demo.

**Why CI does not use the public demo:** the first CI run failed in `auth.setup.ts`: the login form never
appeared. The failure screenshot showed a Cloudflare "Verify you are human" challenge, served to the GitHub
runner's datacenter IP. API tests passed because the API host was not challenged. A bot challenge must not be
worked around in tests, and a shared, externally controlled environment cannot give a deterministic pipeline
anyway, so the system under test now runs inside the CI job.

## 6. Execution strategy
| Trigger | Scope | Browsers |
|---|---|---|
| Pull request | `@smoke` (UI + API), TypeScript and Java jobs in parallel | Chromium |
| Nightly (02:00 UTC) | Full suite (all tags), 3 shards, merged HTML report on GitHub Pages; full Java suite | Chromium, Firefox, WebKit |

**Nightly mechanics:** each shard boots its own Toolshop (no shared data between shards) and writes a blob report;
a merge job turns the blobs into one HTML report, and `main` publishes it to GitHub Pages. The `setup` login project
only runs in shards that contain UI tests. The workflow also runs on PRs that change it, without publishing.
| Local (dev) | anything | Chromium (Firefox opt-in via `ALL_BROWSERS=1`) |

**Why Firefox is CI-only by default:** Playwright's bundled Firefox failed to start on the Windows 11 dev machine
(Windows SxS error: dependent assembly `mozglue` not found). It was not a corrupted download (a forced reinstall
did not change it) and not a missing VC++ runtime. Cross-browser coverage is a CI concern anyway, because CI
runs on Linux, which is the reference environment. Keeping the local loop on Chromium keeps it fast and reliable.

## 7. Two-language suite (TypeScript + Java)
**Decision:** TypeScript is the primary suite. A Java + JUnit 5 module (`java/`) mirrors only the `@smoke` scenarios.

**Why TypeScript first:** Playwright Test (fixtures, projects, retries, sharding, HTML report, trace) and newer
tooling such as Test Agents exist only for Node. **Why Java at all:** many teams run Java stacks (JUnit/TestNG,
Maven), and the same scenarios in both languages show the framework design is not tied to one runner.

**Keeping them in sync:**
- One source of truth for *what* is tested: the scenario names and tags match; the table in the README maps them.
- Mirrored page objects and API client with identical `data-test` locators, so UI changes are mechanical in both.
- Same Playwright version in `package.json` and `java/pom.xml`; same `.env` file and defaults.
- Both run on every PR against the same pinned Toolshop; the shared boot lives in `.github/actions/`.
- New coverage lands in TypeScript; a scenario is ported to Java only when it joins the smoke set.

**Known difference:** the TypeScript suite logs in once (`setup` project + `storageState`); the Java `CartTest`
signs in inside the test, which keeps the Java module free of cross-test state at the cost of a few seconds.

## 8. Accessibility
**What:** axe-core scans against WCAG 2.1 A/AA (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) on six pages:
catalogue, product detail, login, contact, cart step of checkout, account. Tagged `@a11y`, part of the PR gate.

**Known issues instead of exclusions:** Toolshop is third-party, so its existing violations cannot be fixed here.
They are listed per axe rule in `src/a11y/accessibility.ts`, each with where it occurs. A violation of any other rule
fails the test; a listed rule that stops occurring is reported as an annotation so the list only shrinks.
Rule-level entries were chosen over `exclude(selector)`, which would silence *every* rule on that element.

| Rule | Where | Impact |
|---|---|---|
| `label-content-name-mismatch` | Header (all pages): language selector, cart link | serious |
| `list` | Catalogue: category filter `<ul>` contains non-`<li>` children | serious |
| `button-name` | Login: password visibility toggle has no accessible name | critical |

**Why Chromium only:** axe evaluates the DOM, not rendering, so results are engine-independent; Firefox/WebKit skip
`@a11y` via `grepInvert`. **Limits:** automated scans catch a fraction of real issues (no keyboard flow, focus order or
screen-reader output), so they complement manual checks rather than replace them.

## 9. Visual regression
**What:** `toHaveScreenshot()` on Chromium for the header navigation, login form, contact form and catalogue filters,
plus one full-page login screenshot. Tagged `@visual`, part of the PR gate.

**Decisions:**
- **Component screenshots over full pages.** A failure points at one component, and unrelated page changes do not
  break it. The single full-page test shows how to handle dynamic content: `mask` for the notification bar.
- **Dynamic content is removed, not tolerated.** `src/visual/screenshot.css` hides the chat and live-activity
  widgets during capture; animations and the caret are disabled. `maxDiffPixelRatio: 0.01` only absorbs
  anti-aliasing noise. A 20px navbar change in a local check was flagged at 5% of pixels.
- **Baselines come from CI.** Screenshots differ by OS and font rendering, so the committed baselines are
  `*-chromium-linux.png` from the pinned, freshly seeded Toolshop. Adding the `update-snapshots` label to a PR runs
  `update-visual-baselines.yml`, which regenerates them, checks them against a second run and commits them.
  The PNG diff in the PR is the review step. Local runs write `*-win32.png`/`*-darwin.png` baselines, which are
  git-ignored.
- **Chromium only.** One engine is enough to catch layout regressions; three sets of baselines would triple
  maintenance for little extra signal.

## 10. Out of scope (deliberately)
Performance/load testing against the public demo (shared infrastructure), payment provider internals, email delivery.
