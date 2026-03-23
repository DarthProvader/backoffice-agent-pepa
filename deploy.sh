#!/bin/bash
# Deploy script for Hostinger VPS
# Usage: ./deploy.sh user@vps-ip

set -e

VPS=${1:?"Usage: ./deploy.sh user@vps-ip"}

echo "=== Deploying to $VPS ==="

# 1. Ensure Docker is installed on VPS
ssh "$VPS" 'command -v docker >/dev/null || (curl -fsSL https://get.docker.com | sh && sudo usermod -aG docker $USER)'

# 2. Sync project files (exclude node_modules, .venv, data)
rsync -avz --delete \
  --exclude node_modules \
  --exclude .venv \
  --exclude .next \
  --exclude data/backoffice.db \
  --exclude data/outputs \
  --exclude data/task-results \
  --exclude '*.log' \
  ./ "$VPS:~/backoffice-agent/"

# 3. Copy .env if not exists on server
ssh "$VPS" 'test -f ~/backoffice-agent/server/.env || cp ~/backoffice-agent/.env.production.example ~/backoffice-agent/server/.env'

# 4. Build and start
ssh "$VPS" 'cd ~/backoffice-agent && docker compose up -d --build'

echo "=== Deploy complete ==="
echo "Backend: https://$VPS:3001"
echo "Don't forget to:"
echo "  1. Edit server/.env on VPS with real credentials"
echo "  2. Setup Caddy for SSL (copy Caddyfile, install caddy)"
echo "  3. Set Vercel env vars: NEXT_PUBLIC_API_BASE, NEXT_PUBLIC_WS_URL"
