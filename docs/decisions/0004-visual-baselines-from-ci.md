# 0004 – Visual baselines come from CI, on Chromium only

**Status:** Accepted

**Context:** Screenshots differ by OS and font rendering, and the public demo's content changes (other users' brands
lengthened the filter list). Baselines taken on a developer machine would fail in CI and go stale locally.

**Decision:**
- Committed baselines are `*-chromium-linux.png` from the pinned, seeded Toolshop. The `update-snapshots` PR label
  regenerates them, checks them against a second run and commits them. The PNG diff in the PR is the review.
- Prefer component screenshots (header, forms, filter panel) over full pages. Dynamic content is removed, not
  tolerated: widgets are hidden by `src/visual/screenshot.css`, the notification bar and build date are masked,
  and animations and the caret are disabled. `maxDiffPixelRatio: 0.01` only absorbs anti-aliasing noise.
- Chromium only: one engine catches layout regressions; three baseline sets would triple maintenance.

**Consequences:**
- Local runs write `*-win32.png` / `*-darwin.png` baselines, which are git-ignored.
- A 20px navbar change was flagged at 5% of pixels.
- Reviewing the first CI baselines found the footer's build date, which changes with every CI build; it is masked.
