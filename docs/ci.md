# CI – how the pipeline runs and protects itself

> Workflows: `.github/workflows/`. Shared steps: `.github/actions/`. Why it is set up this way: [decisions/](decisions/).

## System under test
CI never uses the public demo. Every job boots Toolshop in Docker from an upstream commit that is pinned in one
place, `.github/actions/toolshop-start` (version, sprint and URLs, exported to the job). The database is
migrated and seeded on every run, so results depend only on the code under test
([ADR 0001](decisions/0001-ci-runs-its-own-toolshop.md)).

`toolshop-ready` installs API dependencies, seeds the database and waits until a data endpoint (`/products`) and the
UI both return 200. A plain health endpoint was green while data endpoints still failed.

## Workflows
| Workflow | Trigger | What runs | Browsers |
|---|---|---|---|
| `pr-smoke.yml` | Every PR and push to `main` | **Static:** lint, typecheck, `check:tags`, `test:architecture`<br/>**Then:** suite `pr` (smoke + a11y + visual) on API + Chromium, and the Java smoke suite, in parallel | Chromium |
| `nightly-regression.yml` | 02:00 UTC, manual, PRs that change it | Suite `nightly` (everything except the agents' seed) in 3 shards, plus the full Java suite | Chromium, Firefox, WebKit |
| `update-visual-baselines.yml` | PR label `update-snapshots` | Regenerates Linux baselines, verifies them with a second run, commits them to the PR | Chromium |

**Nightly mechanics:** each shard boots its own Toolshop (no shared data between shards) and writes a blob report.
A merge job turns the blobs into one HTML report, and runs on `main` publish it to GitHub Pages. The `setup` login
project only runs in shards that contain UI tests. A PR that changes the workflow runs it without publishing.

**Local runs** default to Chromium. Firefox and WebKit are opt-in (`ALL_BROWSERS=1`), because Playwright's Firefox
failed to start on the Windows 11 dev machine (SxS error, `mozglue`), and cross-browser coverage is a CI concern.

## Pipeline summary
Both workflows end with a `pipeline summary` job (`scripts/pipeline-summary.mjs`). It reads the Playwright JSON
results and the Surefire XML reports and writes the run page's job summary:
- a **Mermaid diagram of the run**: the TypeScript and Java lanes with their pass/fail counts, coloured by job result;
- a **table per test ID** with TypeScript and Java results side by side and whether the ID runs in both.

Java reports carry display names (`U6: ...`, `S2: ... › gift-card`) via Surefire's phrased names, so both sides are
matched by test ID. Every A, U and S ID must appear in both columns: the parity architecture test (and the
tier check in `check:tags`) enforce that before any
test runs ([ADR 0009](decisions/0009-every-journey-in-both-languages.md)).

## Tags and suites
- `src/tags.ts` defines every tag and suite. Specs use `Tag.*` (a typo is a compile error). CI and npm scripts pass
  only a suite name (`SUITE=pr`), and `playwright.config.ts` turns it into `grep`/`grepInvert`, adding `@setup`
  where a login is needed.
- **Tiers:** every test has exactly one of `@smoke` (PR gate), `@regression` (nightly), `@setup`, `@seed`.
  **Kinds** are optional: `@negative`, `@e2e`, `@a11y`, `@visual`, `@architecture`, and `@admin`. An `@admin` test signs in as
  the seeded admin and changes catalogue or orders, so it is skipped against the public demo (TS: `adminToken`
  fixture, Java: `@Admin`) and runs against our own Toolshop only.
- **IDs:** every test title (except setup/seed) starts with an ID from [test-plan.md](test-plan.md), e.g. `U6: ...`.
- `npm run check:tags` lists all tests without a browser and prints the count per tag. It fails on unknown tags, a
  missing or duplicate tier, or a missing/unknown ID. The Java `TagGuardTest` applies the same rules to JUnit.

## Visual baselines
Committed baselines are `*-chromium-linux.png` from the pinned, seeded Toolshop. To refresh them, add the
`update-snapshots` label to a PR. Commits pushed with `GITHUB_TOKEN` do not start new runs, so push any commit
afterwards to re-run the PR gate. The PNG diff in the PR is the review step
([ADR 0004](decisions/0004-visual-baselines-from-ci.md)).

## Architecture tests
`tests/architecture/` (project `architecture`, run in the static stage in about a second) fails when:
- a workflow that pushes commits could trigger itself: it must not run on `push`, `workflow_run` or
  `repository_dispatch`; it must keep `GITHUB_TOKEN`, remove its trigger label, and have a concurrency group
- `workflow_run` triggers form a cycle, or a step starts or re-runs a workflow
- composite actions, npm scripts, Playwright project dependencies or TypeScript imports form a cycle
- a job has no `timeout-minutes` ≤ 60, or a shell step uses `while`/`until` instead of a bounded `for … in $(seq …)`

See [ADR 0008](decisions/0008-architecture-tests.md) for what they found on their first run.
