#!/usr/bin/env bash
# Installs Playwright browsers with their OS packages, bounded and retried on another mirror.
# Usage: scripts/install-browsers.sh chromium [firefox webkit]
#
# `playwright install --with-deps` pulls OS packages from the runner's Ubuntu mirror. That mirror has stretched this
# step from about a minute to 29 minutes, and on one run fetched only ~25 packages in 8 minutes. Each attempt gets a
# time limit, and each retry points apt at a different mirror. apt keeps finished downloads in its cache, so a retry
# only fetches what is still missing.
set -euo pipefail

MINUTES_PER_ATTEMPT=8
# Attempt 1 uses the runner's own mirror list; later attempts use these, in order.
FALLBACK_MIRRORS=(http://archive.ubuntu.com/ubuntu/ http://azure.archive.ubuntu.com/ubuntu/)
ATTEMPTS=$((1 + ${#FALLBACK_MIRRORS[@]}))
MIRROR_LIST=/etc/apt/apt-mirrors.txt # GitHub's Ubuntu runners read their mirrors from here (mirror+file:)

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

use_mirror() {
  if [ -f "$MIRROR_LIST" ]; then
    echo "$1" | sudo tee "$MIRROR_LIST" > /dev/null
    echo "apt mirror for the next attempt: $1"
  else
    echo "::warning::$MIRROR_LIST not found; retrying on the same mirror"
  fi
}

for attempt in $(seq 1 "$ATTEMPTS"); do
  if timeout --kill-after=30s "${MINUTES_PER_ATTEMPT}m" npx playwright install --with-deps "$@"; then
    exit 0
  fi
  echo "::warning::Browser install attempt $attempt of $ATTEMPTS failed or took over $MINUTES_PER_ATTEMPT minutes"
  release_apt
  if [ "$attempt" -lt "$ATTEMPTS" ]; then use_mirror "${FALLBACK_MIRRORS[$((attempt - 1))]}"; fi
done

echo "::error::Browser install failed after $ATTEMPTS attempts"
exit 1
