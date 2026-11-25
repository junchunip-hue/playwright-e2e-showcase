# CLAUDE.md

Entry point for a Claude Code session in this repository, local or cloud: the rules that must hold, how to work, and
where the details are. The linked docs are the source of truth; read them instead of guessing.

**The project:** one set of Gherkin features against the Toolshop demo shop, run by two suites, Playwright +
TypeScript (playwright-bdd) and Playwright for Java (Cucumber-JVM). CI boots its own pinned Toolshop; a nightly covers
Chromium, Firefox and WebKit plus Java, and publishes both reports and a
[results page](https://junchunip-hue.github.io/playwright-e2e-showcase/).

## Rules that must not break

1. **Both languages, always.** Every scenario (A, U, S, C) runs in TypeScript **and** Java from the same feature file,
   with the same tier ([ADR 0009](docs/decisions/0009-every-journey-in-both-languages.md)). N tests (visual,
   accessibility, architecture) are TypeScript only.
2. **A failing test stays a failure.** No known-issue markers, expected failures or skips to get green; a test that did
   not run counts as failed ([ADR 0013](docs/decisions/0013-failures-stay-failures.md)). Two deliberate cases are no
   precedent: the axe-rule list in `src/a11y/accessibility.ts`
   ([ADR 0003](docs/decisions/0003-accessibility-known-issues.md)) and C1/C2, which fail on purpose and are not counted.
3. **Fix a flake's cause, never add retries.** CI retries twice in both languages, local runs never; a pass on a retry
   is reported as flaky ([ADR 0011](docs/decisions/0011-retries-and-flaky-tests.md)).
4. **Layers point down only:** steps → fixtures → pages → data → modules / api → config. A step creates no locator, a
   module only declares locators, waits live in pages, no fixed sleeps.
5. **Both reports look and behave the same**; the TypeScript Playwright HTML report is the reference. Failure evidence:
   the screenshot at the failed step plus the trace for browser tests, nothing for API tests.
6. **CI never uses the public demo.** Toolshop is pinned in one place, `.github/actions/toolshop-start`.
7. **IDs are never renumbered or reused.** Next free: A12, U12, S8, N4, C3 (U7–U11 and S7 are taken;
   [how IDs work](docs/test-plan.md#how-ids-work)).
8. **Never edit generated files:** `tests/features/` (by `bddgen`), `docs/steps.md` (by `npm run steps`). Hand-written
   tests are `*.spec.ts`: `bddgen` deletes every `*.spec.js` under `tests/`.
9. **Playwright minors move together:** `@playwright/test` and `playwright.version` in `java/pom.xml`, in one PR.

## Working with the maintainer

- Reply in Korean; everything in the repository (code, comments, commits, PRs, docs) stays in English.
- Commit, push, open or merge a PR, delete a branch or run the nightly only when asked:

  | Request | Means |
  |---|---|
  | "고치기" | a branch from `origin/master` and a PR |
  | "CI 끝나면 결과 알려줘" | wait, then report every check and what the two PR comments say |
  | "#N 성공하면 merge까지" | merge as soon as every check passes, otherwise say why not; unclear number → ask |
  | "병합 후 nightly" | merge, delete the branch, run `nightly-regression.yml` on `master`, report |
  | "README랑 첫 페이지 다시 확인해줘" | compare README and results page with the actual numbers and wording |

- Prove claims with real runs (CI artifacts, live reports, results page), and say what was not verified.
- Never put a token or password in chat or the repository.

## Find your way

| Need | Read |
|---|---|
| Add or change a scenario, step by step | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Wording, layers, code style, what each check enforces | [docs/coding-rules.md](docs/coding-rules.md) |
| Existing steps, by page (reuse before you write) | [docs/steps.md](docs/steps.md) |
| Every test ID, tier, status and finding | [docs/test-plan.md](docs/test-plan.md) |
| Why it is built this way (before changing a decision) | [docs/decisions/](docs/decisions/README.md), [docs/test-strategy.md](docs/test-strategy.md) |
| Workflows, summary, Pages site, PR comments | [docs/ci.md](docs/ci.md) |
| The Java twin, layer by layer | [docs/java.md](docs/java.md) |
| What is open, candidates, out of scope | [docs/roadmap.md §6](docs/roadmap.md#6-what-comes-next) |
| Numbers and layout shown to visitors | [README.md](README.md) |

```
features/                  shared Gherkin: api/ (A), ui/ (U), journeys/ (S, and U6), control/ (C1, C2)
src/  (TypeScript)         java/src/test/java/com/showcase/  (Java)
  steps/       ↔ steps/        one sentence → one page method or API call, or an assertion on a module
  fixtures/    ↔ steps/Hooks, PlaywrightContext, ScenarioContext   injection, failure evidence, not-run steps
  pages/       ↔ pages/        what a user does on a page: actions and waits
  data/        ↔ data/         fresh test data, built through the API
  modules/     ↔ modules/      locators only
  api/         ↔ api/          API client and response contracts (zod / Contracts)
  config/      ↔ config/       URLs and accounts (.env; the defaults are the public demo)
  tags.ts                      the only tag and suite registry: what the PR gate and the nightly run
  reporters/, a11y/, visual/ ↔ report/ScenarioLog (feeds the Java report)
tests/         architecture/ (N3), quality/ (N1 visual, N2 a11y), auth.setup.ts, ui/seed.spec.ts (agents' seed)
scripts/       suite runner, demo, format, step catalogue, CI summary, reports, Pages site, PR impact
.github/       workflows/ (pr-smoke, pr-impact, nightly-regression, update-visual-baselines), actions/ (shared)
.claude/agents/, .mcp.json   Playwright Test Agents: exploration only; generated specs are not committed (specs/README.md)
```

## Change a scenario

1. Row in the test plan (ID, tier `@smoke` = PR gate or `@regression` = nightly, Java column).
2. Scenario in `features/…`, title starts with the ID (`Scenario: U12: …`); tags only from `src/tags.ts`.
3. Reuse steps; a new UI step names its page, an API step says "API". Write step, page and module in **both** languages.
4. Run that ID in both (below), then `npm run format`, `npm run steps`, and the checks.
5. Test counts changed? Update README ("At a glance" and the badge paragraph), `docs/test-plan.md` and the ID table in
   `docs/java.md`. The badges and the counts on the results page come from the run.

## Commands

```bash
npm ci && npx playwright install chromium && cp -n .env.example .env   # once; also sets the pre-push hook
npm run lint && npm run typecheck && npm run check:tags && npm run check:steps && npm run test:architecture
npm run format              # fix style in both languages (format:check only checks); Java needs JDK 21+
npm run steps               # rewrite docs/steps.md
npm run test:api            # API features, no browser
npm run test:pr             # the PR gate's TypeScript suite: smoke + a11y + visual, API and Chromium
npx bddgen && npx playwright test --project=chromium -g "U6"      # one ID; run bddgen before a bare playwright test
node scripts/pr-impact.mjs --base origin/master                   # the scenarios this branch can affect
cd java
./mvnw exec:java -Dexec.args="install chromium"                   # once: the Java suite's browser
./mvnw test -Dgroups=smoke                                        # Java smoke
./mvnw test -Dcucumber.filter.name="U6: .*"                       # one ID
./mvnw test -Dcucumber.execution.dry-run=true -DexcludedGroups=   # every feature step has a Java step
```

## PR, merge, nightly

- `master` changes only through a PR (ruleset, no bypass). Required: `smoke (TypeScript)`, `smoke (Java)` and
  `test verdict / PR smoke`. `PR impact` is not required, but read its two comments (affected scenarios, structure
  check) on every PR. The N3 rules, cycles included, fail the gate; the comment's layer-direction list is advisory.
- A PR body follows [the template](.github/pull_request_template.md), also with `gh pr create --body`, which skips it:
  Why, What, Checked (`Run`, `Not run`, `Nightly`); Notes only when there is something to say. Dependabot is exempt.
- The repository has no auto-merge and does not delete merged branches: wait for the checks, then
  `gh pr merge <n> --merge --delete-branch`.
- The PR gate runs no `@regression` scenario (visual and a11y tests are the exception): when a change affects one, the
  proof is the nightly (02:00 UTC, or `gh workflow run nightly-regression.yml --ref master`, about 10 minutes).
- Results: `gh pr checks <n>`, `gh run view <id> --log-failed`, `gh run download <id> -n <artifact>`
  ([artifacts](docs/ci.md#workflows)); the live site is cached for up to 10 minutes.

## Cloud session

- **Start:** `git fetch origin master` (`pr-impact.mjs` needs `origin/master`), then the first line of Commands. Node 22
  and JDK 21, as in CI. Network access and `gh` depend on the environment: check them before relying on them.
- **No Toolshop or browser needed:** the checks line, `format`, `steps`, `pr-impact.mjs`, Java `test-compile`, dry run.
- **Needs a Toolshop:** `test:api` (the public demo will do), and UI and journey tests (a browser too). On the public
  demo `@admin` and `@own-toolshop` are skipped, and its sign-in is sometimes unavailable. Otherwise let the PR gate run
  them, once asked to push.
- **Visual tests on Linux:** local baselines have the same names as the committed ones (`*-linux.png`), which come from
  the pinned Toolshop. A visual failure against the public demo proves nothing; never commit baselines from there. Use
  the PR label `update-snapshots`; its commit starts no checks, and its PR comment says how to get them
  ([ADR 0004](docs/decisions/0004-visual-baselines-from-ci.md)).
- **If `CI` is set,** runs retry, TypeScript adds Firefox and WebKit, and Maven checks the Java style instead of fixing
  it; unset it for a local-like run.
- **`java/mvnw.cmd` modified in a clean checkout:** a Dependabot wrapper update committed it with CRLF. Fix it with
  `git add --renormalize java/mvnw.cmd`, in its own PR.

## Local Windows

Playwright's Firefox can fail to start with an SxS `mozglue` error, so local runs use Chromium (`ALL_BROWSERS=1` adds
the others) and CI covers the rest. In the Claude desktop app the files sit in its virtualised AppData; a copy outside
AppData starts (`PLAYWRIGHT_BROWSERS_PATH` sets where browsers are installed).
