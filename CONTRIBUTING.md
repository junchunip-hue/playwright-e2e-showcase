# Adding a scenario

From an idea to a green PR, in the order that avoids rework. The rules behind each step are in
[docs/coding-rules.md](docs/coding-rules.md).

## 0. Once: set up

```bash
npm install                        # also installs the pre-push hook (.githooks/)
npx playwright install
cp .env.example .env
```
For the Java lane you also need JDK 21+ ([docs/java.md](docs/java.md)). Without one you can still write the feature
and the TypeScript steps; CI runs the Java lane for you.

## 1. Give it an ID in the test plan

Add a row to [docs/test-plan.md §3](docs/test-plan.md#3-test-inventory) with the **next free number** of its prefix:
`A` for the API, `U` for one page, `S` for a journey across pages
([how IDs work](docs/test-plan.md#how-ids-work)). Set the tier tag (`@smoke` or `@regression`) and the Java column
(✅, because every scenario runs in both languages).

## 2. Look up the steps that already exist

Open [docs/steps.md](docs/steps.md) and find the section of each page your scenario touches. Reuse an existing
sentence wherever the action is the same. That is the main way to avoid writing a second step for the same action.

## 3. Write the scenario

Put it in the right folder: `features/api/`, `features/ui/` or `features/journeys/`. Start the title with the ID:

```gherkin
@regression
Scenario: U12: a signed-in customer sees the product in the cart after a reload
  Given a product that is in stock
  And I have signed in as the demo customer on the login page
  When I open that product's page
  And I add it to the cart on the product page
  And I reload the cart page
  Then the cart lists that product
```

New sentences name the page they act on, describe one action each, and keep `Given` for states, `When` for actions
and `Then` for results ([wording rules](docs/coding-rules.md#gherkin-steps)). In this example, `I reload the cart page`
and `the cart lists that product` would be new.

## 4. Find out which steps are missing

```bash
npx bddgen
```
It lists every sentence without a definition and prints a stub for it.

## 5. Write the steps, top down, in both languages

For each new sentence:

1. **Step:** in TypeScript, `src/steps/<feature>.steps.ts` (or `common.steps.ts` if another feature uses it too). In
   Java, the matching `steps/<Feature>Steps.java` (or `CommonSteps.java`). A step calls one page method or the API
   client, or asserts on the page's module. It never creates a locator.
2. **Page:** if the action is new, add a method to the page (`src/pages/*.page.ts`, `pages/*Page.java`). Waits and
   retries go here.
3. **Module:** if an element is new, add its locator to the page's module (`src/modules/*.module.ts`,
   `modules/*Module.java`). Locators only.

Copy the shape of a neighbouring step. The TypeScript and Java versions mirror each other line for line, so a reviewer
can read them side by side.

## 6. Run it locally

```bash
npx bddgen && npx playwright test --project=chromium -g "U12"     # TypeScript, one ID
cd java && ./mvnw test -Dcucumber.filter.name="U12: .*"            # Java, one ID (formats the Java code first)
npm run demo -- U12                                                 # watch it in a slowed-down browser
```

## 7. Format, update the catalogue, and check

```bash
npm run format          # code style for both languages: layout, indentation, import order
npm run steps           # rewrite docs/steps.md with your new steps
npm run test:pr         # what the PR gate runs (API + Chromium)
```
Commit everything, including `docs/steps.md`. When you push, the pre-push hook runs `format:check` and `check:steps`
and stops the push if something is out of date.

## 8. Open the PR

The PR gate runs the static checks (lint, format, types, tags, steps, architecture), the TypeScript smoke suite and
the Java dry run plus smoke suite. All of them must pass before the PR can merge. A `@regression` scenario runs in the
nightly after the merge, on Chromium, Firefox and WebKit.

If a check fails, its message says what to run. The most common ones:

| Failure | Fix |
|---|---|
| `Code style check failed` / `spotless:check` | `npm run format`, commit |
| `docs/steps.md is out of date` | `npm run steps`, commit |
| `unused step` | delete the step in both languages, or use it |
| `no Java twin` / `no TypeScript twin` / undefined step in the dry run | write the missing definition (step 5) |
| A test title without an ID or a tier tag | fix the title or tags (step 3) |
