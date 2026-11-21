# Coding rules

The rules everyone follows when they add or change a test. Most are checked by a tool, so a PR that breaks one goes
red before a reviewer reads it. Review only checks what no tool can (see the end of this page).
Adding a scenario step by step: [CONTRIBUTING.md](../CONTRIBUTING.md).

## Rules and what enforces them

This table takes the place of a PR checklist: every rule is checked by a tool, and the check runs before the PR
can merge.

| Rule | Checked by | Runs |
|---|---|---|
| One code style: layout, indentation, import order, no unused or wildcard imports | `npm run format:check`: Spotless (Java), Prettier + ESLint (TS, JS, JSON, YAML, Gherkin) | pre-push hook · PR gate |
| Every step is in the catalogue, used by a feature and defined in both languages | `npm run check:steps` | pre-push hook · PR gate |
| Every feature step has a TypeScript and a Java definition | `bddgen` (TS) · Cucumber dry run (Java) | PR gate |
| Steps call pages and create no locators; modules only declare locators | `npm run test:architecture` (N3) | PR gate |
| Every scenario (A, U, S, C) exists in both languages and matches the test plan's Java column | `npm run test:architecture` (N3) | PR gate |
| Every test has exactly one tier tag, only known tags, and a title that starts with its ID | `npm run check:tags` | PR gate |
| Lint and types | `npm run lint`, `npm run typecheck` | PR gate |

The PR gate is the `PR smoke` workflow: the `master` ruleset requires it, so no change merges while a check fails
([ci.md](ci.md#workflows)).

## Code style

**One command fixes everything:** `npm run format`.

| Files | Tool | Style |
|---|---|---|
| Java (`java/src`) | [Spotless](https://github.com/diffplug/spotless) with google-java-format (`java/pom.xml`) | 2-space indent, 100 columns, imports sorted (static first), unused and wildcard imports not allowed |
| TypeScript, JavaScript, JSON, YAML | Prettier (`.prettierrc.json`) | 2-space indent, 120 columns, single quotes, trailing commas |
| Import order (TS, JS) | ESLint `simple-import-sort` (`eslint.config.mjs`) | packages first, then relative imports, each group sorted |
| Gherkin (`features/`) | Prettier with `prettier-plugin-gherkin` | steps indented under the scenario, one tag per line, tables aligned |
| Markdown | by hand | not reformatted, so prose keeps its own line breaks |

**When it runs:**
- **Java formats itself locally:** every `./mvnw test` runs `spotless:apply` before compiling, so Java code is in
  style as soon as it builds. In CI the same build only runs `spotless:check` and fails on an unformatted file.
- **Before every push:** the pre-push hook (`.githooks/pre-push`, installed by `npm install`) runs
  `npm run format:check` and `npm run check:steps`. If it fails, run `npm run format` (and `npm run steps`) and commit.
  Without a JDK the hook skips Java with a warning; CI still checks it.
- **On every PR:** the same checks run in CI, so skipping the hook (`git push --no-verify`) only moves the failure to
  the PR.

**In your editor:** `.editorconfig` sets indentation and line endings. To format on save, use the Prettier
extension (VS Code) and the google-java-format plugin (IntelliJ). The commands above are the reference either way.

The commit that first formatted the repository is listed in `.git-blame-ignore-revs`, so `git blame` and GitHub's
blame view skip it.

## Gherkin steps

A step is a contract between the person writing a feature and the code behind it. Two people writing almost the same
sentence for the same action creates two definitions in each language, which is double work and confusing later.
Two sentences that look alike but act on different pages, with different locators, are confusing too. These rules
prevent both.

**1. Look it up before you write it.** [docs/steps.md](steps.md) lists every step, grouped by where it acts (login
page, catalogue page, product page, checkout, header, mocked network, API), with the features that use it and its
TypeScript and Java definitions. If the action is there, reuse that exact sentence.

**2. A UI step names the page it acts on.** Say where the action happens, so nobody has to open the code to find out
which locators it uses.

| Instead of | Write |
|---|---|
| `When I add it to the cart` | `When I add it to the cart on the product page` |
| `When I search for "pliers"` | `When I search the catalogue page for "pliers"` |
| `When I sign in as that customer` | `When I sign in as that customer at the checkout's sign-in step` (checkout) or `… on the login page` |
| `Then the page shows that product` | `Then the product page shows that product` |

The header (cart badge, user menu) appears on every page, so its steps say "the header" or "the cart badge" instead.

**3. Say when and in which state.** A `Given` describes a state that already holds, and says how it was reached when
that matters: `Given I have signed in as that customer on the login page`. A `When` is one user action at that moment:
`When I open the catalogue page`. A `Then` is an observable result.

**4. One action, one sentence.** Do not combine two actions in one step ("the search works again and I search for…").
Write two steps (`When the search API works again`, `And I search the catalogue page for "pliers"`), each reusable on
its own. A step may still do several page calls if they form one user action, e.g. a sign-in that opens the login
page, signs in and waits for the account page.

**5. API steps say "API".** `When I search the API for "…"`, `When the admin publishes a new product through the API`.
That keeps them apart from the UI steps for the same thing.

**6. Parameters only for data.** Use `{string}` or `{int}` for values that change between scenarios, not to merge two
different actions into one sentence.

**Where a step's code lives:**
- A step used by **one feature** lives in that feature's steps file: `src/steps/<feature>.steps.ts` and
  `java/.../steps/<Feature>Steps.java` (`src/steps/api/` and `steps/api/` for API features).
- A step used by **more than one feature** lives in `src/steps/common.steps.ts` and `CommonSteps.java`.
- Each steps file starts with a comment naming its feature and its twin in the other language.

**After adding or changing a step:** run `npm run steps`. It rewrites `docs/steps.md`, and `npm run check:steps`
(pre-push hook and PR gate) fails if you forget, if a step is no longer used, or if it exists in only one language.

## Layers

Every scenario goes down the same layers in both languages ([ADR 0012](decisions/0012-gherkin-features-with-layered-steps.md)):

| Layer | Job | TypeScript | Java |
|---|---|---|---|
| Feature | the story; title starts with its ID, tags give the tier | `features/` | (same files) |
| Steps | one sentence → one page method or API call, or an assertion on the page's module | `src/steps/` | `steps/` |
| Page | what a user does: actions, waits, retries | `src/pages/*.page.ts` | `pages/*Page.java` |
| Module | where things are: locators only | `src/modules/*.module.ts` | `modules/*Module.java` |

- A locator belongs in the page's module. If two pages show the same element, each module declares its own locator,
  and the step names the page (rule 2 above).
- Waits belong in the page method, never in a step; no fixed sleeps.
- Test data is created fresh through the API (`src/data/`, `data/`), never taken from shared accounts other than the
  demo customer.

## When a test fails

A failing test stays a failure ([ADR 0013](decisions/0013-failures-stay-failures.md)): there are no "known issue"
markers and no expected failures. A red test means one of two things, and that is what gets fixed:

- **The test is wrong** (a wrong expectation, a missing wait, test data that changed): fix the step, page or data.
- **The product is wrong:** fix the product. If it cannot be fixed here (Toolshop is an upstream project), the test
  leaves the suite and the finding is recorded in the test plan, as for A10 and A11.

Every report shows where a scenario failed, step by step: the steps before it passed, one step failed (with its
error), and every step after it was not run.

| Report | Failed step | Steps after it |
|---|---|---|
| TypeScript HTML report | ✗ red, with the error | listed right after it, at the same level, as skipped (⊘) Gherkin steps; test annotations `failed step`, `not run` |
| Java HTML report (same format) | ✗ red, with the error | listed right after it, at the same level, as skipped (Cucumber skips them) |
| Run summary and results page | "Failed tests": ID, where, failed step and error | listed one per line |

The failure control C1 (`features/control`) shows this on a known example every night, outside the verdict. It is the
only test allowed to fail; the tier tag `@control` keeps it out of every other run.

## IDs and tags

- Every scenario has a test-plan ID (A, U, S, N, C) at the start of its title, given as described in
  [test-plan.md](test-plan.md#how-ids-work). An ID is never renumbered or reused.
- Every scenario has exactly one tier tag: `@smoke` (gates every PR) or `@regression` (nightly); the failure control
  C1 alone has `@control`. Other tags come from
  the registry in `src/tags.ts`.

## What review still checks

Tools cannot judge these, so the reviewer does:
- The scenario tells one story a non-developer can follow, and its title says what it proves.
- New step sentences follow the wording rules above, and no existing step was duplicated under another wording.
- The scenario creates its own data and does not depend on what another test left behind.
- The test plan row (ID, tag, Java column, status) describes what was built.
