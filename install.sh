#!/usr/bin/env bash
set -euo pipefail

PANEL_VERSION="${PANEL_VERSION:-latest}"
PANEL_USER="panel"
PANEL_DIR="/var/panel"
CONFIG_DIR="/etc/panel"
BINARY_PATH="/usr/local/bin/panel"
SERVICE_FILE="/etc/systemd/system/panel.service"
GO_VERSION="1.22.4"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'; BOLD='\033[1m'
info()    { echo -e "${GREEN}[panel]${NC} $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
error()   { echo -e "${RED}[error]${NC} $*"; exit 1; }
section() { echo -e "\n${BOLD}═══ $* ═══${NC}\n"; }

[ "$EUID" -ne 0 ] && error "Run as root: sudo bash install.sh"

section "Panel Installer"
info "Detecting OS..."
if [ -f /etc/os-release ]; then
  . /etc/os-release
  OS=$ID
else
  error "Cannot detect OS"
fi

ARCH=$(uname -m)
case $ARCH in
  x86_64)  ARCH_GO="amd64" ;;
  aarch64) ARCH_GO="arm64" ;;
  *)       error "Unsupported architecture: $ARCH" ;;
esac

section "Installing Dependencies"

install_docker() {
  if command -v docker &>/dev/null; then
    info "Docker already installed: $(docker --version)"
    return
  fi
  info "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
}

install_caddy() {
  if command -v caddy &>/dev/null; then
    info "Caddy already installed: $(caddy version)"
    return
  fi
  info "Installing Caddy..."
  case $OS in
    ubuntu|debian)
      apt-get install -y debian-keyring debian-archive-keyring apt-transport-https curl
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
      curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
      apt-get update && apt-get install -y caddy
      ;;
    centos|rhel|fedora|rocky|almalinux)
      dnf install -y 'dnf-command(copr)'
      dnf copr enable @caddy/caddy -y
      dnf install -y caddy
      ;;
    *)
      warn "Unknown OS, attempting direct binary install"
      local tmp=$(mktemp -d)
      curl -fsSL "https://caddyserver.com/api/download?os=linux&arch=${ARCH_GO}" -o "$tmp/caddy"
      chmod +x "$tmp/caddy"
      mv "$tmp/caddy" /usr/local/bin/caddy
      ;;
  esac
}

install_restic() {
  if command -v restic &>/dev/null; then
    info "Restic already installed: $(restic version)"
    return
  fi
  info "Installing Restic..."
  RESTIC_VER="0.16.4"
  curl -fsSL "https://github.com/restic/restic/releases/download/v${RESTIC_VER}/restic_${RESTIC_VER}_linux_${ARCH_GO}.bz2" | \
    bunzip2 > /usr/local/bin/restic
  chmod +x /usr/local/bin/restic
}

install_go() {
  if command -v go &>/dev/null; then
    info "Go already installed: $(go version)"
    return
  fi
  info "Installing Go ${GO_VERSION}..."
  curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${ARCH_GO}.tar.gz" | tar -C /usr/local -xzf -
  echo 'export PATH=$PATH:/usr/local/go/bin' >> /etc/profile.d/go.sh
  export PATH=$PATH:/usr/local/go/bin
}

case $OS in
  ubuntu|debian)
    apt-get update -qq
    apt-get install -y -qq curl git build-essential openssl
    ;;
  centos|rhel|fedora|rocky|almalinux)
    dnf install -y curl git gcc openssl
    ;;
esac

install_docker
install_caddy
install_restic
install_go

section "Creating panel user"
if ! id -u "$PANEL_USER" &>/dev/null; then
  useradd -r -s /bin/bash -m -d "$PANEL_DIR" "$PANEL_USER"
  info "Created user '$PANEL_USER'"
else
  info "User '$PANEL_USER' already exists"
fi

usermod -aG docker "$PANEL_USER"
info "Added '$PANEL_USER' to docker group"

mkdir -p "$PANEL_DIR"/{apps,backups,keys} "$CONFIG_DIR"
chown -R "$PANEL_USER:$PANEL_USER" "$PANEL_DIR"
chmod 750 "$PANEL_DIR" "$CONFIG_DIR"

section "Configuration"

read -p "GitHub OAuth Client ID: " GITHUB_CLIENT_ID
read -s -p "GitHub OAuth Client Secret: " GITHUB_CLIENT_SECRET; echo
read -p "Allowed GitHub usernames (comma-separated): " ALLOWED_USERS_RAW
read -p "Panel base URL (e.g. https://panel.yourdomain.com): " BASE_URL
read -s -p "Encryption key (32+ chars for env var encryption): " ENC_KEY; echo
JWT_SECRET=$(openssl rand -hex 32)

ALLOWED_ARRAY=""
IFS=',' read -ra USERS <<< "$ALLOWED_USERS_RAW"
for u in "${USERS[@]}"; do
  ALLOWED_ARRAY+="  - $(echo $u | xargs)\n"
done

cat > "$CONFIG_DIR/config.yaml" <<EOF
server:
  port: 8080
  host: 127.0.0.1
  base_url: ${BASE_URL}

auth:
  github_client_id: ${GITHUB_CLIENT_ID}
  github_client_secret: ${GITHUB_CLIENT_SECRET}
  jwt_secret: ${JWT_SECRET}
  allowed_users:
$(printf "$ALLOWED_ARRAY")

db:
  path: ${PANEL_DIR}/panel.db

storage:
  apps_dir: ${PANEL_DIR}/apps
  backups_dir: ${PANEL_DIR}/backups
  keys_dir: ${PANEL_DIR}/keys

caddy:
  admin_api: http://localhost:2019

encryption:
  key: ${ENC_KEY}
EOF

chmod 600 "$CONFIG_DIR/config.yaml"
chown "$PANEL_USER:$PANEL_USER" "$CONFIG_DIR/config.yaml"
info "Config written to $CONFIG_DIR/config.yaml"

section "Building Panel"

REPO_DIR=$(mktemp -d)
info "Cloning panel source..."

if [ -d "$(dirname "$0")/backend" ]; then
  info "Using local source"
  REPO_DIR="$(dirname "$0")"
else
  git clone --depth=1 https://github.com/your-org/panel "$REPO_DIR"
fi

export PATH=$PATH:/usr/local/go/bin
export HOME=/root

info "Installing frontend dependencies..."
cd "$REPO_DIR/frontend"
if command -v bun &>/dev/null; then
  bun install && bun run build
else
  npm install && npm run build
fi

info "Building backend binary..."
cd "$REPO_DIR/backend"
go build -ldflags="-s -w" -o "$BINARY_PATH" .
chmod +x "$BINARY_PATH"
info "Binary installed at $BINARY_PATH"

section "Setting up Caddy"

cat > /etc/caddy/Caddyfile <<'EOF'
{
  admin localhost:2019
}
EOF

systemctl enable --now caddy
info "Caddy started"

section "Creating systemd service"

cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Panel - Self-Hosted Deployment Platform
After=network.target docker.service caddy.service
Requires=docker.service

[Service]
Type=simple
User=${PANEL_USER}
Group=${PANEL_USER}
ExecStart=${BINARY_PATH} --config ${CONFIG_DIR}/config.yaml
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
Environment=HOME=${PANEL_DIR}

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable panel
systemctl start panel

section "Done!"

PANEL_PORT=8080
info "Panel is running at http://127.0.0.1:${PANEL_PORT}"
echo ""
echo -e "${BOLD}Next steps:${NC}"
echo "  1. Configure DNS for your domain to point to this server"
echo "  2. Add $BASE_URL/api/auth/callback as GitHub OAuth callback URL"
echo "  3. Access panel via Caddy reverse proxy or SSH tunnel"
echo "  4. Configure S3 backup storage in panel Settings"
echo ""
echo -e "  Logs: ${YELLOW}journalctl -u panel -f${NC}"
echo -e "  Stop: ${YELLOW}systemctl stop panel${NC}"
echo ""
