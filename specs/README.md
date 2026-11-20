# Specs: plans from the Playwright Test Agents

The planner agent (`.claude/agents/playwright-test-planner.md`) explores the app from the seed
(`tests/ui/seed.spec.ts`: a signed-in customer on the catalogue) and saves its test plans here as Markdown.

The agents are an exploration aid, not where the suite lives. Their output is plain Playwright code, while every
scenario in this repository is a shared Gherkin feature (ADR 0012). A plan worth keeping therefore becomes:

1. a row in `docs/test-plan.md` with the next free ID,
2. a scenario in `features/{api,ui,journeys}/`,
3. steps in `src/steps/` and `java/src/test/java/com/showcase/steps/` that call pages, and locators in the modules.

Generated specs are not committed as tests. The healer agent can still debug a failing test; a locator it suggests
belongs in a module.
