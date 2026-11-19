#!/usr/bin/env bash
# Antigravity Custom Theme — uninstaller for macOS and Linux.
# Windows users: double-click 卸载.bat instead.
set -u

cd "$(dirname "$0")" || exit 1

echo "================================================"
echo "  Antigravity Custom Theme - Uninstall"
echo "================================================"
echo

if ! command -v node >/dev/null 2>&1; then
  echo "[X] Node.js not found. Install Node 18+ and run this again."
  exit 1
fi

echo "Stopping Antigravity if it is running..."
node lib/patcher.cjs --uninstall
status=$?

if [ $status -ne 0 ]; then
  echo
  echo "[X] Uninstall failed."
  exit $status
fi

echo
echo "Restarting Antigravity..."
case "$(uname -s)" in
  Darwin)
    if [ -d /Applications/Antigravity.app ]; then
      open -a /Applications/Antigravity.app
    elif [ -d "$HOME/Applications/Antigravity.app" ]; then
      open -a "$HOME/Applications/Antigravity.app"
    else
      echo "[!] Could not find Antigravity.app - start it yourself."
    fi
    ;;
  *)
    found=""
    for p in /opt/Antigravity/antigravity /opt/antigravity/antigravity \
             /usr/bin/antigravity /usr/local/bin/antigravity; do
      if [ -x "$p" ]; then found="$p"; break; fi
    done
    if [ -n "$found" ]; then
      nohup "$found" >/dev/null 2>&1 &
    else
      echo "[!] Could not find the Antigravity binary - start it yourself."
    fi
    ;;
esac

echo
echo "Restored the original app. Your settings are kept in ~/.gemini/config/agy-bg"
