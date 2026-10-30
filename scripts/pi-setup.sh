#!/bin/bash
# Raspberry Pi: checks the Pi, then installs the E46 head unit on it.
#
# Run it on the Pi (in its terminal, or over SSH from the PC):
#
#   bash <(curl -fsSL https://raw.githubusercontent.com/ATABESHA/e46-headunit/main/scripts/pi-setup.sh)
#
#   ... --check   only check the Pi, install nothing
#
# Everything it finds is also saved to ~/e46-pi-report.txt, so it can be
# copied back in one go.
set -uo pipefail

REPO="$HOME/e46-headunit"
REPORT="$HOME/e46-pi-report.txt"
CHECK_ONLY=0
[[ "${1:-}" == "--check" ]] && CHECK_ONLY=1

: >"$REPORT"
say() { echo "$*" | tee -a "$REPORT"; }
line() { printf '  %-16s %s\n' "$1" "$2" | tee -a "$REPORT"; }
problem() { say "  !! $*"; PROBLEMS=$((PROBLEMS + 1)); }
PROBLEMS=0

# ---------------------------------------------------------------- check
say "=== E46 head unit: Raspberry Pi check ($(date '+%Y-%m-%d %H:%M')) ==="

MODEL="$( (tr -d '\0' </proc/device-tree/model) 2>/dev/null || echo unknown)"
. /etc/os-release 2>/dev/null
ARCH="$(uname -m)"
MEM_MB="$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)"
DISK_FREE="$(df -h --output=avail "$HOME" | tail -1 | tr -d ' ')"
ROOT_DEV="$(findmnt -n -o SOURCE /)"
NODE_V="$(node -v 2>/dev/null || echo none)"

line "Model" "$MODEL"
line "System" "${PRETTY_NAME:-unknown} (${VERSION_CODENAME:-?})"
line "Architecture" "$ARCH"
line "Memory" "${MEM_MB} MB"
line "Free space" "$DISK_FREE"
line "Runs from" "$ROOT_DEV$([[ $ROOT_DEV == /dev/mmcblk* ]] && echo ' (SD card)' || echo ' (USB / NVMe)')"
line "Node.js" "$NODE_V"
line "Desktop" "${XDG_SESSION_TYPE:-none in this terminal} / ${XDG_CURRENT_DESKTOP:-?}"
line "Graphics driver" "$(lsmod 2>/dev/null | grep -qE '^v3d' && echo 'v3d (hardware 3D on)' || echo 'v3d NOT loaded')"

if command -v vcgencmd >/dev/null; then
  line "Temperature" "$(vcgencmd measure_temp | cut -d= -f2)"
  THROTTLED="$(vcgencmd get_throttled | cut -d= -f2)"
  line "Power/heat log" "$THROTTLED"
  # Bits: 0 under-voltage now, 2 throttled now, 16 under-voltage since boot, 18 throttled since boot.
  (( THROTTLED & 0x10001 )) && problem "Power supply too weak (under-voltage). The Pi slows itself down: use the official power supply (Pi 4: 5V 3A, Pi 5: 5V 5A)."
  (( THROTTLED & 0x40004 )) && problem "The Pi got too hot and slowed down. A heatsink or fan helps a lot."
fi
line "CPU speed mode" "$(cat /sys/devices/system/cpu/cpu0/cpufreq/scaling_governor 2>/dev/null || echo ?)"

case "$MODEL" in
  *"Pi 5"*) say "  -> Pi 5: good for the head unit, CarPlay included." ;;
  *"Pi 4"*) say "  -> Pi 4: fine for the head unit on Low/Premium graphics." ;;
  *"Pi 400"*) say "  -> Pi 400: same as a Pi 4, fine on Low/Premium graphics." ;;
  *"Pi 3"*) say "  -> Pi 3: works on Low graphics only, slow to react; CarPlay video will struggle." ;;
  *) problem "Unknown or older board: may be too slow." ;;
esac
(( MEM_MB < 1800 )) && problem "Less than 2 GB memory: installing needs patience; close other programs."
[[ "$ARCH" != "aarch64" ]] && problem "32-bit system. It works, but the 64-bit Raspberry Pi OS is noticeably faster."
[[ "${XDG_SESSION_TYPE:-}" == "tty" || -z "${XDG_CURRENT_DESKTOP:-}" ]] && say "  (Desktop shows as none because this is an SSH/terminal login - that's normal.)"
if [[ "$ROOT_DEV" == /dev/mmcblk* ]]; then
  say "  Tip: a USB SSD instead of the SD card makes start-up and installing much faster."
fi
say "  Problems found: $PROBLEMS"

if [[ "$MODEL" != *"Raspberry Pi"* ]]; then
  say "This is not a Raspberry Pi - for a laptop use scripts/install.sh instead."
  exit 1
fi

if (( CHECK_ONLY )); then
  say "Check only - nothing installed. Report saved to $REPORT"
  exit 0
fi

# ---------------------------------------------------------------- install
step() { say ""; say "=== $* ==="; }
set -e

step "Installing Node.js 22 (if needed)"
if [[ "$NODE_V" == none ]] || (( $(node -p 'process.versions.node.split(".")[0]') < 20 )); then
  sudo apt update
  sudo apt install -y curl ca-certificates
  # The system's own Node.js is too old on many Pi systems; NodeSource has current ones.
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt install -y nodejs
fi
say "  Node.js $(node -v)"

step "Downloading the project"
sudo apt install -y git
if [[ -d "$REPO/.git" ]]; then
  git -C "$REPO" pull --ff-only
else
  git clone https://github.com/ATABESHA/e46-headunit.git "$REPO"
fi

step "Installing the head unit (takes 10-20 minutes on a Pi)"
# Pi screen flags: draw natively on the Pi desktop (Wayland) instead of
# through the slower compatibility layer, and let Chromium use the Pi's
# graphics chip even where it is cautious about its driver.
export E46_ELECTRON_FLAGS="--ozone-platform-hint=auto --ignore-gpu-blocklist"
# Building on a 1-2 GB Pi: give Node a little more room.
export NODE_OPTIONS="--max-old-space-size=1024"
bash "$REPO/scripts/install.sh" --autostart 2>&1 | tee -a "$REPORT"

say ""
say "=== Done ==="
say "Restart the Pi (sudo reboot) - the head unit then opens full screen by itself."
say "Report saved to $REPORT"
