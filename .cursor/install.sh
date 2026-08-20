#!/usr/bin/env bash
# One-time, idempotent setup for the ndertimi Cloud Agent environment.
# Installs system dependencies (Docker + Supabase CLI), Node dependencies, the
# local env file, and warms the local Supabase Docker images so the first
# `start` is fast.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing system packages (docker, iptables, fuse-overlayfs)"
sudo apt-get update -qq
# noninteractive avoids the fuse3 conffile prompt wedging dpkg
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
  -o Dpkg::Options::=--force-confold \
  docker.io iptables fuse-overlayfs uidmap curl
sudo dpkg --configure -a || true

echo "==> Installing Supabase CLI"
if ! command -v supabase >/dev/null 2>&1; then
  LATEST=$(curl -sL https://api.github.com/repos/supabase/cli/releases/latest \
    | grep -oP '"tag_name":\s*"\K[^"]+')
  curl -sL -o /tmp/supabase.deb \
    "https://github.com/supabase/cli/releases/download/${LATEST}/supabase_${LATEST#v}_linux_amd64.deb"
  sudo dpkg -i /tmp/supabase.deb
fi

echo "==> Configuring Docker daemon for nested containers (fuse-overlayfs)"
sudo mkdir -p /etc/docker
echo '{ "storage-driver": "fuse-overlayfs", "features": { "containerd-snapshotter": false } }' \
  | sudo tee /etc/docker/daemon.json >/dev/null

echo "==> Writing .env.local (local Supabase keys)"
if [ ! -f .env.local ]; then
  cat > .env.local <<'EOF'
# Local development — points at the local Supabase stack (supabase start).
# These are the standard fixed local Supabase demo keys.
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH

# Maps bare usernames (e.g. "donard") to the management email domain so the
# role logic in lib/roles.ts grants the financial dashboard.
NEXT_PUBLIC_AUTH_EMAIL_DOMAIN=etnagroup-ks.com

# OpenAI (fuel-receipt OCR) — optional. Add a real key to enable /api/ocr.
# OPENAI_API_KEY=
EOF
fi

echo "==> Installing Node dependencies"
npm ci

echo "==> Warming local Supabase (pulls images, applies migrations + seed)"
bash "$(dirname "$0")/start.sh"

echo "==> install.sh complete"
