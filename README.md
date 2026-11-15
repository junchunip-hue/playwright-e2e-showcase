# Playwright E2E Showcase

[![PR Smoke Tests](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/pr-smoke.yml/badge.svg)](https://github.com/junchunip-hue/playwright-e2e-showcase/actions/workflows/pr-smoke.yml)

A production-style test automation framework built with **Playwright + TypeScript**, targeting the public
[Practice Software Testing (Toolshop)](https://practicesoftwaretesting.com) demo shop.

The goal is to show how I would set up E2E testing in a real team: risk-based scope, API + UI layering,
stable locators, isolated test data and CI integration, not just a collection of scripts.

## Highlights
- **Page Objects + custom fixtures**: tests receive page objects and an API client through dependency injection
- **API + UI hybrid tests**: the backend is the source of truth for UI assertions
- **Authenticated session reuse** with a `setup` project and `storageState`
- **Tag-based suites**: `@smoke`, `@regression`, `@negative`
- **CI on every PR** (GitHub Actions): lint, typecheck, smoke tests, HTML report artifact
- **Isolated CI environment**: CI boots Toolshop in Docker (pinned upstream commit, freshly seeded DB) instead of
  depending on the shared public demo
- **Documented test strategy**: see [`docs/test-strategy.md`](docs/test-strategy.md)

## Project structure
```
src/
  api/          typed REST client (Toolshop API)
  config/       environment handling
  fixtures/     custom Playwright fixtures
  pages/        page & component objects
tests/
  auth.setup.ts login once, save session
  ui/           browser tests
  api/          API tests
```

## Getting started
```bash
npm install
npx playwright install
cp .env.example .env
npm run test:smoke      # quick check
npm test                # everything
npm run report          # open the HTML report
```

## Roadmap
- [ ] Checkout E2E with API-created test user
- [x] Run the app in Docker in CI for full data control
- [ ] Nightly regression with sharding + merged report published to GitHub Pages
- [ ] Visual regression and accessibility (axe-core) checks
