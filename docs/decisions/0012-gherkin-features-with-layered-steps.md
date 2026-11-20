# 0012 – Scenarios as shared Gherkin features, in layers: steps → pages → modules

**Status:** Accepted (reverses "a BDD/Gherkin layer is out of scope" in the test strategy and roadmap)

**Context:** A journey test mixed four things in one place: the business story, the order of user actions, how
each action is done (waits, retries), and where the elements are (locators). Readers had to read code to learn what
a scenario checks, and the TypeScript and Java versions of one scenario were kept equal only by IDs and review.
The earlier reason against Gherkin ("no business author to write it") ignored the reader: the person maintaining
or reviewing a scenario benefits from reading it step by step, and from seeing the same text drive both languages.

**Options considered:**
- Keep plain specs: no new tooling, but the story and the mechanics stay mixed, and the two languages can drift.
- cucumber-js + Cucumber-JVM: one model in both languages, but TypeScript would lose Playwright Test's runner
  (fixtures, retries, sharding, traces, the HTML and JSON reports the CI summary reads).
- **playwright-bdd + Cucumber-JVM, one shared set of features** (chosen).

**Decision:**
- Scenarios (A, U, S) are written once in `features/**/*.feature`, read by both suites: TypeScript through
  playwright-bdd (`npx bddgen` turns them into Playwright tests), Java through Cucumber-JVM on JUnit 5
  (`com.showcase.RunCucumberTest`, PicoContainer for injection). N1–N3 (visual, accessibility, architecture) stay
  plain specs: they check the build, not user behaviour.
- Four layers, the same names in both languages:

  | Layer | Job | TypeScript | Java |
  |---|---|---|---|
  | Feature | the story, in Gherkin; scenario name starts with its ID, tags give the tier | `features/` | (same files) |
  | Steps | one Gherkin sentence → one page method, or an assertion on the page's module | `src/steps/*.steps.ts` | `steps/*Steps.java` |
  | Page | what a user does: actions, waits, retries | `src/pages/*.page.ts` | `pages/*Page.java` |
  | Module | where things are: locators only | `src/modules/*.module.ts` | `modules/*Module.java` |

- Architecture tests keep the layers honest: modules contain no actions, steps create no locators, and every CI
  step that runs Playwright generates the features first.
- The mechanisms built on test titles and tags keep working unchanged: the scenario name carries the ID, Gherkin
  tags become Playwright and JUnit tags (`SUITE=pr`, `-Dgroups=smoke`), and both reports name the scenario
  (`U1: …`, Surefire `Login - U1: …`), so the CI summary, flaky detection and "not run" still match by ID.

**Consequences:**
- One wording per scenario: a step sentence changed in a feature must change in both step layers, or that
  scenario fails in the language that lacks it (an undefined step fails, and `bddgen` refuses missing steps).
- Moved in phases, each its own PR: UI (#35, #37), journeys (#38, #39), API (#40), then cleanup. Every A/U/S
  scenario is now a feature; only N1–N3 (quality and architecture) stay plain specs, by design.
- `bddgen` runs before every Playwright run; generated tests live in `tests/features/` (git-ignored). playwright-bdd
  requires the projects' testDir to be its output folder, so that is `tests/`; it deletes only `*.spec.js` there,
  and hand-written tests are `*.spec.ts` (an architecture test forbids hand-written `.spec.js`).
- Java runs Cucumber 7.x, the last line on JUnit 5; Cucumber 8 needs JUnit 6. Surefire's CI reruns work on
  scenarios too (a scenario that passes on a rerun is reported as flaky, ADR 0011).
