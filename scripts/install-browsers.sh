#!/usr/bin/env bash
# Installs Playwright browsers with their OS packages, bounded and retried.
# Usage: scripts/install-browsers.sh chromium [firefox webkit]
#
# `playwright install --with-deps` pulls OS packages from the Ubuntu mirror. A slow mirror once stretched this step
# from about a minute to 29 minutes, and a stalled one would hang until the job timeout. Each attempt gets a time
# limit. apt keeps finished and partial downloads in its cache, so a retry continues where the last attempt stopped
# (on a fresh connection, possibly to another mirror) instead of starting over.
set -euo pipefail

ATTEMPTS=3
MINUTES_PER_ATTEMPT=8

# `timeout` stops npx, but the apt-get it started through sudo keeps running and holds the dpkg lock, so the next
# attempt would fail at once ("Could not get lock /var/lib/dpkg/lock-frontend"). Stop it, wait for the lock to go,
# and let dpkg finish anything it had half-configured.
release_apt() {
  sudo pkill -TERM -x apt-get || true
  for _ in $(seq 1 30); do
    pgrep -x apt-get > /dev/null || pgrep -x dpkg > /dev/null || break
    sleep 2
  done
  sudo pkill -KILL -x apt-get || true
  sudo dpkg --configure -a || true
}

for attempt in $(seq 1 "$ATTEMPTS"); do
  if timeout --kill-after=30s "${MINUTES_PER_ATTEMPT}m" npx playwright install --with-deps "$@"; then
    exit 0
  fi
  echo "::warning::Browser install attempt $attempt of $ATTEMPTS failed or took over $MINUTES_PER_ATTEMPT minutes"
  release_apt
done

echo "::error::Browser install failed after $ATTEMPTS attempts"
exit 1
