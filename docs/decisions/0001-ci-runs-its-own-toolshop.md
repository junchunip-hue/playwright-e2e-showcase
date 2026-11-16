# 0001 – CI runs its own Toolshop instead of the public demo

**Status:** Accepted

**Context:** The first CI run failed in `auth.setup.ts`: the login form never appeared. The failure screenshot showed a
Cloudflare "Verify you are human" challenge served to the GitHub runner's datacenter IP. API tests passed because
the API host was not challenged. Besides, the public demo is shared: its data changes and other users' actions show up.

**Decision:** Every CI job boots Toolshop in Docker from an upstream commit pinned in
`.github/actions/toolshop-start`, and migrates and seeds the database on each run. Bot challenges are not worked
around in tests.

**Consequences:**
- Results depend only on the code under test, and data is identical on every run, which is what makes visual
  baselines and exact API contracts possible.
- Each job spends a few minutes booting Toolshop. Shards each boot their own instance, so they never share data.
- Bumping Toolshop is a one-line change in one file.
- After the first boot, Laravel returned 500 on data endpoints while `/status` was green: the container user could
  not write the file cache. The setup makes the storage folders writable, and the readiness check probes
  `/products` instead of a health endpoint.
