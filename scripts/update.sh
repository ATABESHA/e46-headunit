#!/bin/bash
# Gets the newest version from GitHub, rebuilds and restarts.
#   bash scripts/update.sh
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO"

git pull --ff-only
npm ci --no-audit --no-fund || npm install --no-audit --no-fund
npm run build

# npm reinstalls Electron, so its sandbox helper needs root ownership again.
(cd ui && node -e "require('electron')")
SANDBOX="$(dirname "$(cd ui && node -p "require('electron')" | tail -n 1)")/chrome-sandbox"
sudo chown root:root "$SANDBOX"
sudo chmod 4755 "$SANDBOX"

systemctl --user restart e46-core.service

echo "Updated. Restart the screen app to see the changes (Ctrl+Shift+Q, then open it again)."
