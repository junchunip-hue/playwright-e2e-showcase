#!/usr/bin/env bash
# Installs Playwright browsers with their OS packages, bounded, retried on another mirror, from a package cache.
# Usage: scripts/install-browsers.sh chromium [firefox webkit]
#   PLAYWRIGHT_JAVA_DIR=java  use the Playwright for Java CLI of that Maven project instead of npx
#   APT_ARCHIVES=<dir>        where apt keeps the .deb files (default ~/.cache/apt-archives, cached by the
#                             install-browsers action)
#
# `playwright install --with-deps` pulls OS packages from the runner's Ubuntu mirror: 140 MB for the three browsers,
# 22 MB for Chromium alone. That mirror has stretched this step from about a minute to 29 minutes, and on one run
# fetched only ~25 packages in 8 minutes. So:
#   - apt keeps its .deb files in APT_ARCHIVES, which the workflow caches; packages already there are not fetched.
#   - each attempt gets a time limit, and each retry points apt at a different mirror. Finished downloads stay in
#     APT_ARCHIVES, so a retry only fetches what is still missing.
set -euo pipefail

MINUTES_PER_ATTEMPT=8
# Attempt 1 uses the runner's own mirror list; later attempts use these, in order.
FALLBACK_MIRRORS=(http://archive.ubuntu.com/ubuntu/ http://azure.archive.ubuntu.com/ubuntu/)
ATTEMPTS=$((1 + ${#FALLBACK_MIRRORS[@]}))
MIRROR_LIST=/etc/apt/apt-mirrors.txt # GitHub's Ubuntu runners read their mirrors from here (mirror+file:)
APT_ARCHIVES="${APT_ARCHIVES:-$HOME/.cache/apt-archives}"
APT_CONF=/etc/apt/apt.conf.d/90playwright-archives

if [ -n "${PLAYWRIGHT_JAVA_DIR:-}" ]; then
  cd "$PLAYWRIGHT_JAVA_DIR"
  INSTALL=(./mvnw -B -q exec:java "-Dexec.args=install --with-deps $*")
else
  INSTALL=(npx playwright install --with-deps "$@")
fi

# Point apt's download directory at APT_ARCHIVES and keep the files after installing. A directory of our own also
# sidesteps any clean-up hook that empties /var/cache/apt/archives.
use_archive_cache() {
  mkdir -p "$APT_ARCHIVES/partial"
  printf 'Dir::Cache::Archives "%s";\nBinary::apt::APT::Keep-Downloaded-Packages "true";\n' "$APT_ARCHIVES" |
    sudo tee "$APT_CONF" > /dev/null
  echo "apt package cache: $(find "$APT_ARCHIVES" -maxdepth 1 -name '*.deb' | wc -l) packages in $APT_ARCHIVES"
}

# Drop versions the mirror no longer offers (keeps the cache from growing) and hand the folder back to the runner
# user: apt wrote it as root, and the cache action must be able to read it.
prepare_cache_for_saving() {
  sudo apt-get -qq autoclean || true
  sudo rm -rf "$APT_ARCHIVES/lock" "$APT_ARCHIVES/partial"
  sudo chown -R "$(id -u):$(id -g)" "$APT_ARCHIVES"
  echo "apt package cache: $(du -sh "$APT_ARCHIVES" | cut -f1) to save"
}

# `timeout` stops the CLI, but the apt-get it started through sudo keeps running and holds the dpkg lock, so the next
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

use_archive_cache
for attempt in $(seq 1 "$ATTEMPTS"); do
  if timeout --kill-after=30s "${MINUTES_PER_ATTEMPT}m" "${INSTALL[@]}"; then
    prepare_cache_for_saving
    exit 0
  fi
  echo "::warning::Browser install attempt $attempt of $ATTEMPTS failed or took over $MINUTES_PER_ATTEMPT minutes"
  release_apt
  if [ "$attempt" -lt "$ATTEMPTS" ]; then use_mirror "${FALLBACK_MIRRORS[$((attempt - 1))]}"; fi
done

echo "::error::Browser install failed after $ATTEMPTS attempts"
exit 1
