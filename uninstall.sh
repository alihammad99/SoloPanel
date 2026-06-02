#!/usr/bin/env bash
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
info()    { echo -e "${GREEN}[panel]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
section() { echo -e "\n${BOLD}═══ $* ═══${NC}\n"; }

[ "$EUID" -ne 0 ] && echo "Run as root: sudo bash uninstall.sh" && exit 1

section "Panel Uninstaller"

warn "This will remove Panel, its data, and all configuration."
read -p "Are you sure? Type 'yes' to confirm: " CONFIRM
[ "$CONFIRM" != "yes" ] && echo "Aborted." && exit 0

section "Stopping and disabling service"
systemctl stop panel 2>/dev/null && info "Service stopped" || true
systemctl disable panel 2>/dev/null && info "Service disabled" || true
rm -f /etc/systemd/system/panel.service
systemctl daemon-reload

section "Removing binary and config"
rm -f /usr/local/bin/panel /usr/local/bin/panel.bak
rm -rf /etc/panel
info "Binary and config removed"

section "Removing data"
read -p "Remove all app data in /var/panel? (yes/no): " REMOVE_DATA
if [ "$REMOVE_DATA" = "yes" ]; then
  rm -rf /var/panel
  info "Data directory removed"
else
  warn "Skipping data removal — /var/panel still exists"
fi

section "Removing panel user"
if id -u panel &>/dev/null; then
  userdel panel 2>/dev/null && info "User 'panel' removed" || warn "Could not remove user (may have running processes)"
fi

section "Done"
info "Panel has been uninstalled."
echo ""
echo "Docker, Caddy, and Restic were NOT removed (they may be used by other services)."
echo "To remove them manually:"
echo "  apt-get remove -y caddy restic   # Debian/Ubuntu"
echo "  dnf remove -y caddy restic       # RHEL/Fedora"
