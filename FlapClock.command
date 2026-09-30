#!/bin/sh
# FlapClock launcher for macOS - opens the flip clock fullscreen.
#
# Double-click this file in Finder. The first run may say the file is not
# executable: right-click -> Open, or run  chmod +x FlapClock.command  once.
#
# A Terminal window stays open behind the clock. That is normal for a .command
# file; close it with Cmd+Q, or Cmd+Tab away from it.

set -e

# Resolve the folder this script lives in, following symlinks, so the clock is
# found even when the launcher is run from a different working directory.
src=$0
while [ -L "$src" ]; do
  dir=$(cd -P "$(dirname "$src")" && pwd)
  src=$(readlink "$src")
  case $src in
    /*) ;;
    *) src=$dir/$src ;;
  esac
done
dir=$(cd -P "$(dirname "$src")" && pwd)
page="$dir/index.html"

if [ ! -f "$page" ]; then
  echo "index.html not found next to this launcher."
  echo "Expected: $page"
  echo
  echo "Press Return to close."
  read -r _
  exit 1
fi

# Spaces are legal in a file:// URL but are safer encoded.
url=$(printf 'file://%s' "$page" | sed 's/ /%20/g')

# Prefer a Chromium browser, which can be told to go fullscreen on launch.
# Safari cannot, so it is only the last resort. Names go through "set --" rather
# than a $apps variable so that "Google Chrome" stays one word.
set -- "Google Chrome" "Chromium" "Microsoft Edge" "Brave Browser" \
       "Microsoft Edge Canary" "Microsoft Edge Beta"

for app in "$@"; do
  for base in /Applications "$HOME/Applications"; do
    exe="$base/$app.app/Contents/MacOS/$app"
    if [ -x "$exe" ]; then
      "$exe" --start-fullscreen --new-window --no-first-run \
             --no-default-browser-check "$url" >/dev/null 2>&1 &
      exit 0
    fi
  done
done

# No Chromium browser found - open the page in whatever the default is, then
# press F for fullscreen.
open "$page"
