#!/usr/bin/env bash
# Installs Playwright browsers with their OS packages, bounded and retried.
# Usage: scripts/install-browsers.sh chromium [firefox webkit]
#
# `playwright install --with-deps` pulls OS packages from the Ubuntu mirror. A slow mirror once stretched this step
# from about a minute to 29 minutes, and a stalled one would hang until the job timeout. Each attempt gets a time
# limit; a retry often lands on a faster mirror.
set -euo pipefail

ATTEMPTS=3
MINUTES_PER_ATTEMPT=6

for attempt in $(seq 1 "$ATTEMPTS"); do
  if timeout --kill-after=30s "${MINUTES_PER_ATTEMPT}m" npx playwright install --with-deps "$@"; then
    exit 0
  fi
  echo "::warning::Browser install attempt $attempt of $ATTEMPTS failed or took over $MINUTES_PER_ATTEMPT minutes"
  # A killed apt run can leave dpkg half-configured; finish that before the next attempt.
  sudo dpkg --configure -a || true
done

echo "::error::Browser install failed after $ATTEMPTS attempts"
exit 1
