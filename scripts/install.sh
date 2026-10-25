#!/bin/bash
# Installs the E46 head unit on the laptop (Ubuntu 24.04 or newer).
#
#   bash scripts/install.sh              install, add "E46 Head Unit" to the app menu
#   bash scripts/install.sh --autostart  also start it fullscreen after every login
#
# Safe to run again (for example after an update).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
AUTOSTART=0
[[ "${1:-}" == "--autostart" ]] && AUTOSTART=1

step() { echo; echo "=== $* ==="; }

step "1/5 Installing system packages"
sudo apt update
sudo apt install -y nodejs npm git

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if (( NODE_MAJOR < 20 )); then
  echo "Node.js $NODE_MAJOR is too old (need 20 or newer)." >&2
  exit 1
fi

step "2/5 Installing app dependencies"
cd "$REPO"
npm ci --no-audit --no-fund || npm install --no-audit --no-fund

step "3/5 Building the screen app"
npm run build

ELECTRON="$(cd "$REPO/ui" && node -p "require('electron')")"

step "4/5 Allowing the screen app to run (AppArmor)"
# Ubuntu blocks Electron's security sandbox unless the app has a profile.
sudo tee /etc/apparmor.d/e46-headunit >/dev/null <<EOF
abi <abi/4.0>,
include <tunables/global>

profile e46-headunit "$ELECTRON" flags=(unconfined) {
  userns,
  include if exists <local/e46-headunit>
}
EOF
sudo apparmor_parser -r /etc/apparmor.d/e46-headunit

step "5/5 Setting up start-up"
# Core service: runs in the background and restarts by itself if it crashes.
mkdir -p "$HOME/.config/systemd/user"
cat > "$HOME/.config/systemd/user/e46-core.service" <<EOF
[Unit]
Description=E46 head unit core service

[Service]
WorkingDirectory=$REPO/core
ExecStart=$(command -v node) $REPO/core/src/index.js
Restart=on-failure
RestartSec=2

[Install]
WantedBy=default.target
EOF
systemctl --user daemon-reload
systemctl --user enable e46-core.service
systemctl --user restart e46-core.service

# Screen app: entry in the app menu.
mkdir -p "$HOME/.local/share/applications"
cat > "$HOME/.local/share/applications/e46-headunit.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=E46 Head Unit
Comment=Car infotainment system (Ctrl+Shift+Q to quit)
Exec="$ELECTRON" "$REPO/ui" --kiosk
Icon=applications-multimedia
Terminal=false
Categories=AudioVideo;
EOF

mkdir -p "$HOME/.config/autostart"
if (( AUTOSTART )); then
  cp "$HOME/.local/share/applications/e46-headunit.desktop" "$HOME/.config/autostart/"
  echo "Autostart: ON (the head unit opens fullscreen after login)"
else
  rm -f "$HOME/.config/autostart/e46-headunit.desktop"
  echo "Autostart: off (run with --autostart to turn it on)"
fi

echo
echo "Done. Open 'E46 Head Unit' from the app menu."
echo "To quit the fullscreen app: Ctrl + Shift + Q"
