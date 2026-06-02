# SoloPanel — Self-Hosted Deployment Platform

A lightweight VPS deployment panel. Deploy apps from GitHub, manage Docker containers, handle SSL/domains via Caddy, backup to S3, and monitor resources — all from a clean UI.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Preact + Vite + TailwindCSS |
| Backend | Go (chi router) + SQLite/GORM |
| Proxy / SSL | Caddy (automatic Let's Encrypt) |
| Backups | Restic → S3-compatible |
| Auth | GitHub OAuth → JWT |

## One-Command Install

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/panel/main/install.sh | sudo bash
```

The installer will:
1. Install Docker, Caddy, Restic, Go (if missing)
2. Create a non-root `panel` system user (added to `docker` group)
3. Prompt for GitHub OAuth credentials and allowed usernames
4. Build the binary and install as a systemd service
5. Start the panel on `localhost:8080`

## Manual Setup

### 1. Prerequisites

```bash
# Docker
curl -fsSL https://get.docker.com | sh

# Caddy
apt install caddy

# Restic
apt install restic

# Go 1.22+
snap install go --classic
```

### 2. Build

```bash
# Frontend
cd frontend && bun install && bun run build

# Backend
cd backend && go build -o panel .
```

### 3. Configure

```bash
cp config.example.yaml /etc/panel/config.yaml
# Edit with your GitHub OAuth credentials and allowed usernames
```

### 4. GitHub OAuth App

Create a GitHub OAuth App at https://github.com/settings/developers:
- **Homepage URL**: `https://panel.yourdomain.com`
- **Callback URL**: `https://panel.yourdomain.com/api/auth/callback`

### 5. Run

```bash
./backend/panel --config /etc/panel/config.yaml
```

## Features

- **App Deployment** — connect a GitHub repo, auto-detect tech stack (Bun, Node, Python, Go, Rust, Ruby, Docker), build & deploy
- **Auto Stack Detection** — detects `bun.lockb`, `package.json`, `go.mod`, `requirements.txt`, `Dockerfile`, `docker-compose.yml` and sets correct install/build/start commands
- **Per-App Deploy Keys** — read-only SSH Ed25519 key pairs generated per app, never store write tokens
- **Env Vars** — stored AES-256 encrypted at rest in SQLite
- **Docker Management** — list/start/stop/remove containers, images, volumes, networks
- **Marketplace** — one-click deploy from a remote registry (Supabase, OpenWA, n8n, Postgres, Redis, MinIO, WordPress, Gitea)
- **Domains & SSL** — Caddy API integration, automatic Let's Encrypt certificates
- **Backups** — Restic-powered backups to any S3-compatible storage (AWS S3, Cloudflare R2, MinIO)
- **Resource Monitor** — real-time CPU, memory, disk, network sparklines via SSE
- **Auth** — GitHub OAuth only, allowlist-based access control

## Security Model

- Panel runs as non-root `panel` user
- Docker socket access via `docker` group membership only
- GitHub OAuth tokens in httpOnly JWT cookies (server-signed, 7-day expiry)
- Per-app read-only SSH deploy keys
- Env vars AES-256-GCM encrypted in SQLite
- Caddy handles all TLS; panel API only on `localhost:8080`
- Allowlist: only listed GitHub usernames can log in

## Environment Variables (alternative to config.yaml)

| Variable | Description |
|---|---|
| `GITHUB_CLIENT_ID` | GitHub OAuth Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth Client Secret |
| `JWT_SECRET` | JWT signing secret |
| `ENCRYPTION_KEY` | AES key for env var encryption |
| `STATIC_DIR` | Path to built frontend (default: `./static`) |

## Project Structure

```
panel/
├── backend/           # Go binary
│   ├── api/           # HTTP handlers + router
│   ├── auth/          # GitHub OAuth + JWT
│   ├── config/        # YAML config loader
│   ├── db/            # GORM models + SQLite
│   ├── services/      # deploy, docker, caddy, backup, monitor, marketplace, crypto, sshkeys
│   └── static/        # built frontend (after bun run build)
├── frontend/          # Preact + Vite + TailwindCSS
│   └── src/
│       ├── pages/     # Dashboard, Apps, Docker, Marketplace, Domains, Backups, Settings
│       ├── components/# Sidebar, ResourceMonitor, LogViewer
│       └── api/       # fetch client + SSE helper
├── install.sh         # one-command installer
├── config.example.yaml
└── README.md
```

## Logs

```bash
journalctl -u panel -f
```
# SoloPanel
